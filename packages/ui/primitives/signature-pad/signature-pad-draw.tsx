import { unsafe_useEffectOnce } from '@documenso/lib/client-only/hooks/use-effect-once';
import { SIGNATURE_CANVAS_DPI, SIGNATURE_MIN_COVERAGE_THRESHOLD } from '@documenso/lib/constants/signatures';

import { Trans } from '@lingui/react/macro';
import { Undo2 } from 'lucide-react';
import type { StrokeOptions } from 'perfect-freehand';
import { getStroke } from 'perfect-freehand';
import type { MouseEvent, PointerEvent, RefObject, TouchEvent } from 'react';
import { useMemo, useRef, useState } from 'react';

import { cn } from '../../lib/utils';
import { getSvgPathFromStroke } from './helper';
import { Point } from './point';
import { SignaturePadColorPicker } from './signature-pad-color-picker';

const checkSignatureValidity = (element: RefObject<HTMLCanvasElement>) => {
  if (!element.current) {
    return false;
  }

  const ctx = element.current.getContext('2d');

  if (!ctx) {
    return false;
  }

  const imageData = ctx.getImageData(0, 0, element.current.width, element.current.height);
  const data = imageData.data;
  let filledPixels = 0;
  const totalPixels = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) {
      filledPixels++;
    }
  }

  const filledPercentage = filledPixels / totalPixels;
  const isValid = filledPercentage > SIGNATURE_MIN_COVERAGE_THRESHOLD;

  return isValid;
};

export type SignaturePadDrawProps = {
  className?: string;
  value: string;
  onChange: (_signatureDataUrl: string) => void;
};

export const SignaturePadDraw = ({ className, value, onChange, ...props }: SignaturePadDrawProps) => {
  const $el = useRef<HTMLCanvasElement>(null);

  const $imageData = useRef<ImageData | null>(null);
  const $fileInput = useRef<HTMLInputElement>(null);

  // Current (in-progress) stroke points. Held in a ref instead of state so a
  // pointermove never triggers a React re-render while drawing.
  const $currentLine = useRef<Point[]>([]);
  // Offscreen canvas accumulating all committed strokes + the loaded image.
  const $committedCanvas = useRef<HTMLCanvasElement | null>(null);

  const [isPressed, setIsPressed] = useState(false);
  const [lines, setLines] = useState<Point[][]>([]);
  const [isSignatureValid, setIsSignatureValid] = useState<boolean | null>(null);

  const [selectedColor, setSelectedColor] = useState('black');

  const perfectFreehandOptions = useMemo(() => {
    const size = $el.current ? Math.min($el.current.height, $el.current.width) * 0.03 : 10;

    return {
      size,
      thinning: 0.25,
      streamline: 0.5,
      smoothing: 0.5,
      end: {
        taper: size * 2,
      },
    } satisfies StrokeOptions;
  }, []);

  const getCommittedCanvas = () => {
    if (!$committedCanvas.current && $el.current) {
      $committedCanvas.current = document.createElement('canvas');
      $committedCanvas.current.width = $el.current.width;
      $committedCanvas.current.height = $el.current.height;
    }

    return $committedCanvas.current;
  };

  const fillStroke = (ctx: CanvasRenderingContext2D, line: Point[]) => {
    const pathData = new Path2D(getSvgPathFromStroke(getStroke(line, perfectFreehandOptions)));

    ctx.fillStyle = selectedColor;
    ctx.fill(pathData);
  };

  /**
   * Redraws the visible canvas from the committed offscreen layer plus the
   * in-progress stroke. Only the active stroke is re-rendered per move.
   */
  const redraw = () => {
    const canvas = $el.current;
    const ctx = canvas?.getContext('2d');

    if (!canvas || !ctx) {
      return;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const committed = getCommittedCanvas();

    if (committed) {
      ctx.drawImage(committed, 0, 0);
    }

    if ($currentLine.current.length > 0) {
      fillStroke(ctx, $currentLine.current);
    }
  };

  const onMouseDown = (event: MouseEvent | PointerEvent | TouchEvent) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    setIsPressed(true);

    const point = Point.fromEvent(event, SIGNATURE_CANVAS_DPI, $el.current);

    $currentLine.current = [point];
  };

  const onMouseMove = (event: MouseEvent | PointerEvent | TouchEvent) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    if (!isPressed) {
      return;
    }

    const point = Point.fromEvent(event, SIGNATURE_CANVAS_DPI, $el.current);
    const lastPoint = $currentLine.current[$currentLine.current.length - 1];

    if (lastPoint && point.distanceTo(lastPoint) > 5) {
      $currentLine.current = [...$currentLine.current, point];

      redraw();
    }
  };

  const onMouseUp = (event: MouseEvent | PointerEvent | TouchEvent, addLine = true) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    setIsPressed(false);

    const point = Point.fromEvent(event, SIGNATURE_CANVAS_DPI, $el.current);

    const newLines = [...lines];

    if (addLine && $currentLine.current.length > 0) {
      newLines.push([...$currentLine.current, point]);
      $currentLine.current = [...$currentLine.current, point];
    }

    setLines(newLines);

    const committed = getCommittedCanvas();
    const committedCtx = committed?.getContext('2d');

    if (committedCtx) {
      committedCtx.imageSmoothingEnabled = true;
      committedCtx.imageSmoothingQuality = 'high';
      fillStroke(committedCtx, $currentLine.current);
    }

    $currentLine.current = [];

    redraw();

    if ($el.current && newLines.length > 0) {
      const isValidSignature = checkSignatureValidity($el);

      setIsSignatureValid(isValidSignature);

      if (isValidSignature) {
        onChange?.($el.current.toDataURL());
      }
    }
  };

  const onMouseEnter = (event: MouseEvent | PointerEvent | TouchEvent) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    if ('buttons' in event && event.buttons === 1) {
      onMouseDown(event);
    }
  };

  const onMouseLeave = (event: MouseEvent | PointerEvent | TouchEvent) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    if (isPressed) {
      onMouseUp(event, true);
    } else {
      onMouseUp(event, false);
    }
  };

  const onClearClick = () => {
    if ($el.current) {
      const ctx = $el.current.getContext('2d');

      ctx?.clearRect(0, 0, $el.current.width, $el.current.height);
      $imageData.current = null;
    }

    const committed = getCommittedCanvas();

    if (committed) {
      committed.getContext('2d')?.clearRect(0, 0, committed.width, committed.height);
    }

    $currentLine.current = [];

    if ($fileInput.current) {
      $fileInput.current.value = '';
    }

    onChange('');

    setLines([]);
    setIsPressed(false);
  };

  const onUndoClick = () => {
    if (lines.length === 0 || !$el.current) {
      return;
    }

    const newLines = lines.slice(0, -1);
    setLines(newLines);

    // Rebuild the committed layer from the remaining lines, then redraw.
    const committed = getCommittedCanvas();
    const committedCtx = committed?.getContext('2d');

    if (committed && committedCtx) {
      committedCtx.clearRect(0, 0, committed.width, committed.height);
      committedCtx.imageSmoothingEnabled = true;
      committedCtx.imageSmoothingQuality = 'high';

      if ($imageData.current) {
        committedCtx.putImageData($imageData.current, 0, 0);
      }

      newLines.forEach((line) => {
        fillStroke(committedCtx, line);
      });
    }

    redraw();

    onChange?.($el.current.toDataURL());
  };

  unsafe_useEffectOnce(() => {
    if ($el.current) {
      $el.current.width = $el.current.clientWidth * SIGNATURE_CANVAS_DPI;
      $el.current.height = $el.current.clientHeight * SIGNATURE_CANVAS_DPI;
    }

    if ($el.current && value) {
      const ctx = $el.current.getContext('2d');

      const { width, height } = $el.current;

      const img = new Image();

      img.onload = () => {
        ctx?.drawImage(img, 0, 0, Math.min(width, img.width), Math.min(height, img.height));

        const defaultImageData = ctx?.getImageData(0, 0, width, height) || null;

        $imageData.current = defaultImageData;

        // Bake the loaded image into the committed layer so a later move/undo
        // redraw preserves it.
        const committed = getCommittedCanvas();
        const committedCtx = committed?.getContext('2d');

        committedCtx?.drawImage(img, 0, 0, Math.min(width, img.width), Math.min(height, img.height));
      };

      img.src = value;
    }
  });

  return (
    <div className={cn('h-full w-full', className)}>
      <canvas
        data-testid="signature-pad-draw"
        ref={$el}
        className={cn('h-full w-full', {
          'dark:hue-rotate-180 dark:invert': selectedColor === 'black',
        })}
        style={{ touchAction: 'none' }}
        onPointerMove={(event) => onMouseMove(event)}
        onPointerDown={(event) => onMouseDown(event)}
        onPointerUp={(event) => onMouseUp(event)}
        onPointerLeave={(event) => onMouseLeave(event)}
        onPointerEnter={(event) => onMouseEnter(event)}
        {...props}
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
