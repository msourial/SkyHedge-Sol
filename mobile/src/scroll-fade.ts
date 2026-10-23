import { C } from "../../shared/storm-glass.ts";

/** Dissolves scroll content into the canvas just above the pay panel. */
export const SCROLL_FADE_HEIGHT = 48;

/**
 * One band per dp. Android paints these as real view backgrounds.
 * A shader fade from alpha 0 was invisible under the scroll view on device.
 */
export const SCROLL_FADE_BANDS = SCROLL_FADE_HEIGHT;

/** Top of the ramp. The rest of the 48dp eases to solid canvas at the panel edge. */
export const SCROLL_FADE_START = 0.18;

/**
 * Smoothstep from 18% canvas at the top to fully opaque canvas on the last dp.
 * The previous curve stayed clear for the first 42%, which is all that showed
 * once the fade sat under the panel.
 */
export function fadeBandAlphas(steps = SCROLL_FADE_BANDS): number[] {
  const count = Math.max(2, Math.round(steps));
  const last = count - 1;
  return Array.from({ length: count }, (_, index) => {
    const t = last === 0 ? 1 : index / last;
    const eased = t * t * (3 - 2 * t);
    return Math.round((SCROLL_FADE_START + (1 - SCROLL_FADE_START) * eased) * 1000) / 1000;
  });
}

/** `rgba()` for the canvas graphite. Same RGB at every stop, so the dissolve stays flat. */
export function canvasFadeColor(alpha: number): string {
  const hex = C.canvas.replace("#", "");
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const clamped = Math.min(1, Math.max(0, alpha));
  return `rgba(${r},${g},${b},${clamped})`;
}

/**
 * Android draws a column of alpha views. iOS and web use expo-linear-gradient,
 * which already ships with this Expo SDK and is a native layer on iOS.
 */
export function scrollFadeKind(os: string): "bands" | "gradient" {
  return os === "android" ? "bands" : "gradient";
}

/**
 * Push a card that is only peeking into the fold fully below it.
 * A card that is properly on screen, or already below the fold, stays put.
 * `sliver` is the most of a clipped top edge we still treat as a peek.
 */
export function foldNudge(cardTopInViewport: number, viewportHeight: number, sliver = 56): number {
  if (!(viewportHeight > 0) || !Number.isFinite(cardTopInViewport)) return 0;
  const showing = viewportHeight - cardTopInViewport;
  if (showing <= 0 || showing >= sliver) return 0;
  return Math.ceil(showing + 8);
}
