import { unsafe_useEffectOnce } from '@documenso/lib/client-only/hooks/use-effect-once';
import { SIGNATURE_CANVAS_DPI, SIGNATURE_MIN_COVERAGE_THRESHOLD } from '@documenso/lib/constants/signatures';

import { Trans } from '@lingui/react/macro';
import { Undo2 } from 'lucide-react';
import type { StrokeOptions } from 'perfect-freehand';
import { getStroke } from 'perfect-freehand';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useRef, useState } from 'react';

import { cn } from '../../lib/utils';
import { getSvgPathFromStroke } from './helper';
import { Point } from './point';
import { SignaturePadColorPicker } from './signature-pad-color-picker';

const DEFAULT_STROKE_OPTIONS: StrokeOptions = {
  size: 10,
  thinning: 0.25,
  streamline: 0.5,
  smoothing: 0.5,
  end: {
    taper: 20,
  },
};

/**
 * Stride-samples the alpha channel (every 4th pixel) — ~4x faster than a
 * per-pixel scan with the same coverage-ratio semantics.
 */
const checkSignatureValidity = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    return false;
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let filledPixels = 0;
  let sampledPixels = 0;

  for (let i = 3; i < data.length; i += 16) {
    sampledPixels++;

    if (data[i] > 0) {
      filledPixels++;
    }
  }

  return filledPixels / sampledPixels > SIGNATURE_MIN_COVERAGE_THRESHOLD;
};

export type SignaturePadDrawProps = {
  className?: string;
  value: string;
  onChange: (_signatureDataUrl: string) => void;
};

/**
 * Two stacked canvases: the base holds committed strokes (and the loaded
 * image) and is never touched while drawing; the transparent overlay holds
 * only the in-progress stroke. A pointermove therefore costs a clear + one
 * stroke fill on the overlay — no full-canvas blit — and redraws are
 * coalesced to one per animation frame.
 */
export const SignaturePadDraw = ({ className, value, onChange, ...props }: SignaturePadDrawProps) => {
  // Committed strokes + loaded image (visible, bottom layer).
  const $baseEl = useRef<HTMLCanvasElement>(null);
  // In-progress stroke only (visible, transparent, top layer — receives events).
  const $overlayEl = useRef<HTMLCanvasElement>(null);

  const $imageData = useRef<ImageData | null>(null);
  const $currentLine = useRef<Point[]>([]);
  const $strokeOptions = useRef<StrokeOptions>(DEFAULT_STROKE_OPTIONS);
  const $rafId = useRef<number | null>(null);
  const $pressed = useRef(false);
  const $rect = useRef<DOMRect | null>(null);

  const [lines, setLines] = useState<Point[][]>([]);
  const [isSignatureValid, setIsSignatureValid] = useState<boolean | null>(null);
  const [selectedColor, setSelectedColor] = useState('black');

  const fillStroke = (ctx: CanvasRenderingContext2D, line: Point[]) => {
    if (line.length === 0) {
      return;
    }

    const pathData = new Path2D(getSvgPathFromStroke(getStroke(line, $strokeOptions.current)));

    ctx.fillStyle = selectedColor;
    ctx.fill(pathData);
  };

  /** Coalesces redraws to at most one per animation frame. */
  const scheduleOverlayRedraw = () => {
    if ($rafId.current !== null) {
      return;
    }

    $rafId.current = requestAnimationFrame(() => {
      $rafId.current = null;

      const canvas = $overlayEl.current;
      const ctx = canvas?.getContext('2d');

      if (!canvas || !ctx) {
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      fillStroke(ctx, $currentLine.current);
    });
  };

  const pointFromClient = (clientX: number, clientY: number): Point => {
    const rect = $rect.current ?? $overlayEl.current?.getBoundingClientRect();
    let x = 0;
    let y = 0;

    if (rect) {
      x = Math.min(Math.max(rect.left, clientX), rect.right) - rect.left;
      y = Math.min(Math.max(rect.top, clientY), rect.bottom) - rect.top;
    }

    return new Point(x * SIGNATURE_CANVAS_DPI, y * SIGNATURE_CANVAS_DPI);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    $pressed.current = true;
    $rect.current = $overlayEl.current?.getBoundingClientRect() ?? null;

    try {
      $overlayEl.current?.setPointerCapture(event.pointerId);
    } catch {
      // Capture is best-effort; drawing still works without it.
    }

    $currentLine.current = [pointFromClient(event.clientX, event.clientY)];

    scheduleOverlayRedraw();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    if (!$pressed.current) {
      return;
    }

    // High-frequency pens batch multiple samples per event — consume them all.
    const native = event.nativeEvent;
    const coalesced = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [];
    const samples = coalesced.length > 0 ? coalesced : [native];

    let needsRedraw = false;

    for (const sample of samples) {
      const point = pointFromClient(sample.clientX, sample.clientY);
      const lastPoint = $currentLine.current[$currentLine.current.length - 1];

      if (!lastPoint || point.distanceTo(lastPoint) > 5) {
        // push (not spread) — avoids an O(n) array copy on every sample.
        $currentLine.current.push(point);
        needsRedraw = true;
      }
    }

    if (needsRedraw) {
      scheduleOverlayRedraw();
    }
  };

  /**
   * Commits the stroke to the base layer. The expensive parts (coverage
   * check + PNG encode) are deferred so this returns before the next frame.
   */
  const finishStroke = (clientX: number, clientY: number, addPoint: boolean) => {
    if (!$pressed.current) {
      return;
    }

    $pressed.current = false;
    $rect.current = null;

    if ($currentLine.current.length === 0) {
      return;
    }

    if (addPoint) {
      $currentLine.current.push(pointFromClient(clientX, clientY));
    }

    const line = $currentLine.current;
    $currentLine.current = [];

    const baseCtx = $baseEl.current?.getContext('2d');

    if (baseCtx) {
      baseCtx.imageSmoothingEnabled = true;
      baseCtx.imageSmoothingQuality = 'high';
      fillStroke(baseCtx, line);
    }

    const newLines = [...lines, line];
    setLines(newLines);

    // Clear the overlay on the next frame (after the last scheduled redraw).
    scheduleOverlayRedraw();
    requestAnimationFrame(() => {
      const overlay = $overlayEl.current;
      overlay?.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height);
    });

    // ponytail: deferred export — if a new stroke commits before this runs the
    // result is simply superseded by the next export.
    setTimeout(() => {
      const base = $baseEl.current;

      if (!base || newLines.length === 0) {
        return;
      }

      const isValidSignature = checkSignatureValidity(base);

      setIsSignatureValid(isValidSignature);

      if (isValidSignature) {
        onChange?.(base.toDataURL());
      }
    }, 0);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    try {
      $overlayEl.current?.releasePointerCapture(event.pointerId);
    } catch {
      // Capture may already be released.
    }

    finishStroke(event.clientX, event.clientY, true);
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    finishStroke(event.clientX, event.clientY, false);
  };

  const onClearClick = () => {
    const base = $baseEl.current;

    if (base) {
      base.getContext('2d')?.clearRect(0, 0, base.width, base.height);
      $imageData.current = null;
    }

    const overlay = $overlayEl.current;

    if (overlay) {
      overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height);
    }

    $currentLine.current = [];

    onChange('');

    setLines([]);
    setIsSignatureValid(null);
  };

  const onUndoClick = () => {
    if (lines.length === 0) {
      return;
    }

    const newLines = lines.slice(0, -1);
    setLines(newLines);

    const base = $baseEl.current;
    const baseCtx = base?.getContext('2d');

    if (base && baseCtx) {
      baseCtx.clearRect(0, 0, base.width, base.height);
      baseCtx.imageSmoothingEnabled = true;
      baseCtx.imageSmoothingQuality = 'high';

      if ($imageData.current) {
        baseCtx.putImageData($imageData.current, 0, 0);
      }

      newLines.forEach((line) => {
        fillStroke(baseCtx, line);
      });

      // ponytail: deferred export, same supersede rule as finishStroke.
      setTimeout(() => {
        const current = $baseEl.current;

        if (current) {
          onChange?.(current.toDataURL());
        }
      }, 0);
    }

    const overlay = $overlayEl.current;

    if (overlay) {
      overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height);
    }
  };

  unsafe_useEffectOnce(() => {
    const base = $baseEl.current;
    const overlay = $overlayEl.current;

    if (base) {
      base.width = base.clientWidth * SIGNATURE_CANVAS_DPI;
      base.height = base.clientHeight * SIGNATURE_CANVAS_DPI;
    }

    if (overlay) {
      overlay.width = overlay.clientWidth * SIGNATURE_CANVAS_DPI;
      overlay.height = overlay.clientHeight * SIGNATURE_CANVAS_DPI;
    }

    if (base) {
      const size = Math.min(base.width, base.height) * 0.03;

      $strokeOptions.current = {
        size,
        thinning: 0.25,
        streamline: 0.5,
        smoothing: 0.5,
        end: {
          taper: size * 2,
        },
      };
    }

    if (base && value) {
      const ctx = base.getContext('2d');

      const { width, height } = base;

      const img = new Image();

      img.onload = () => {
        ctx?.drawImage(img, 0, 0, Math.min(width, img.width), Math.min(height, img.height));

        $imageData.current = ctx?.getImageData(0, 0, width, height) ?? null;
      };

      img.src = value;
    }

    return () => {
      if ($rafId.current !== null) {
        cancelAnimationFrame($rafId.current);
      }
    };
  });

  const darkModeFilter = selectedColor === 'black' ? 'dark:hue-rotate-180 dark:invert' : undefined;

  return (
    <div className={cn('relative h-full w-full', className)}>
      <canvas
        data-testid="signature-pad-draw"
        ref={$baseEl}
        className={cn('h-full w-full', darkModeFilter)}
        {...props}
      />

      <canvas
        ref={$overlayEl}
        className={cn('absolute inset-0 h-full w-full', darkModeFilter)}
        style={{ touchAction: 'none' }}
        onPointerDown={(event) => onPointerDown(event)}
        onPointerMove={(event) => onPointerMove(event)}
        onPointerUp={(event) => onPointerUp(event)}
        onPointerCancel={(event) => onPointerCancel(event)}
      />

      <SignaturePadColorPicker selectedColor={selectedColor} setSelectedColor={setSelectedColor} />

      <div className="absolute right-3 bottom-3 flex gap-2">
        <button
          type="button"
          className="rounded-full p-0 text-[0.688rem] text-muted-foreground/60 ring-offset-background hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onClearClick()}
        >
          <Trans>Clear Signature</Trans>
        </button>
      </div>

      {isSignatureValid === false && (
        <div className="absolute bottom-4 left-4 flex gap-2">
          <span className="text-destructive text-xs">
            <Trans>Signature is too small</Trans>
          </span>
        </div>
      )}

      {isSignatureValid && lines.length > 0 && (
        <div className="absolute bottom-4 left-4 flex gap-2">
          <button
            type="button"
            title="undo"
            className="rounded-full p-0 text-[0.688rem] text-muted-foreground/60 ring-offset-background hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onUndoClick}
          >
            <Undo2 className="h-4 w-4" />
            <span className="sr-only">
              <Trans>Undo</Trans>
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
