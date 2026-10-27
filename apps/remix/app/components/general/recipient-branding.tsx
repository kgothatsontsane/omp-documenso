import type { TCssVarsSchema } from '@documenso/lib/types/css-vars';
import { useEffect } from 'react';

import { toNativeCssVars } from '~/utils/css-vars';

export type RecipientBrandingPayload = {
  allowCustomBranding: boolean;
  colors?: TCssVarsSchema | null;
  css?: string | null;
};

export type RecipientBrandingProps = {
  branding: RecipientBrandingPayload | null | undefined;
  cspNonce: string | undefined;
};

/**
 * Renders a `<style nonce>` block for a recipient route, scoped to the
 * `.documenso-branded` wrapper rendered in `_recipient+/_layout.tsx`.
 *
 * Both the CSS variables (from `branding.colors`) and the user's custom CSS
 * (from `branding.css`) are emitted inside a single nested rule so the user
 * doesn't need to scope their own selectors — native CSS nesting handles it:
 *
 *   .documenso-branded {
 *     --background: ...;
 *     .my-class { color: red; }
 *   }
 *
 * Equivalent to `.documenso-branded .my-class { color: red; }` after expansion.
 *
 * The user's CSS is sanitised at write time (`sanitizeBrandingCss`) and stored
 * in the DB as-is — no per-render parsing.
 *
 * Why both SSR `<style>` and a `useEffect` injection?
 *
 * The rendered `<style>` covers the initial server render so the first paint
 * already has the branding applied — without it, the page would flash the
 * default theme before hydration.
 *
 * The `useEffect` covers in-app client-side navigations. When the user
 * navigates between recipient routes via the router, the server render
 * doesn't run again, so React reconciles the existing DOM. If the loader
 * data changes (e.g. a different recipient with different branding), the
 * SSR'd `<style>` from the previous page may persist or be reused, leading
 * to stale or inconsistent branding. Appending a fresh `<style>` to
 * `document.head` and removing it on cleanup guarantees the active branding
 * matches the current route on both initial load and subsequent navigations.
 */
/**
 * Surface/text-family variables. Brand palettes are authored against the
 * LIGHT theme; in dark mode they must NOT override the theme's own dark
 * background/text colors — otherwise text renders near-black on a near-black
 * background (unreadable). These are scoped to `html:not(.dark)` so dark mode
 * falls back to the theme palette.
 */
const THEME_SCOPED_COLOR_KEYS = new Set([
  'background',
  'foreground',
  'muted',
  'mutedForeground',
  'popover',
  'popoverForeground',
  'card',
  'cardBorder',
  'cardBorderTint',
  'cardForeground',
  'fieldCard',
  'fieldCardBorder',
  'fieldCardForeground',
  'widget',
  'widgetForeground',
  'border',
  'input',
  // Action/button pairs too: a foreground color must always contrast with its
  // theme background, and palettes authored for light break when paired with
  // the dark theme's own foreground (e.g. black text on a black button).
  'primary',
  'primaryForeground',
  'secondary',
  'secondaryForeground',
  'accent',
  'accentForeground',
  'destructive',
  'destructiveForeground',
  'ring',
  'envelopeEditorBackground',
]);

export const RecipientBranding = ({ branding, cspNonce }: RecipientBrandingProps) => {
  const varsMap = toNativeCssVars(branding?.colors ?? {});

  const themeScopedEntries: string[] = [];
  const alwaysEntries: string[] = [];

  for (const [key, value] of Object.entries(varsMap)) {
    // `--radius` is geometry, not color — apply in both themes.
    if (key === '--radius') {
      alwaysEntries.push(`${key}: ${value};`);
      continue;
    }

    const semanticKey = key.replace(/^--/, '');

    if (THEME_SCOPED_COLOR_KEYS.has(semanticKey)) {
      themeScopedEntries.push(`${key}: ${value};`);
    } else {
      alwaysEntries.push(`${key}: ${value};`);
    }
  }

  // Accent/action colors + geometry apply in both themes.
  const alwaysBlock = alwaysEntries.length > 0 ? `.documenso-branded { ${alwaysEntries.join(' ')} }` : '';
  // Surface/text colors follow the light theme only.
  const lightBlock =
    themeScopedEntries.length > 0 ? `html:not(.dark) .documenso-branded { ${themeScopedEntries.join(' ')} }` : '';

  const userCss = branding?.css ?? '';
  const hasUserCss = userCss.trim().length > 0;

  const css = `${alwaysBlock}\n${lightBlock}\n${hasUserCss ? `.documenso-branded { ${userCss} }` : ''}`.trim();

  const hasCss = css.length > 0;

  useEffect(() => {
    if (!branding?.allowCustomBranding) {
      return;
    }

    if (!hasCss) {
      return;
    }

    const style = document.createElement('style');
    style.setAttribute('nonce', cspNonce ?? '');
    style.textContent = css;

    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, [branding, cspNonce, css, hasCss]);

  if (!branding?.allowCustomBranding) {
    return null;
  }

  if (!hasCss) {
    return null;
  }

  return <style nonce={cspNonce}>{css}</style>;
};
