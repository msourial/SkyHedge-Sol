import { C } from "../../shared/storm-glass.ts";

/** Dissolves scroll content into the canvas just above the pay panel. */
export const SCROLL_FADE_HEIGHT = 48;

/**
 * One band per dp. Android paints these as real view backgrounds.
 * A shader fade from alpha 0 was invisible under the scroll view on device.
 */
export const SCROLL_FADE_BANDS = SCROLL_FADE_HEIGHT;

/**
 * Clear through the upper half so the footnote stays readable, then solid
 * canvas over the last 12dp so a clipped card edge cannot sit on the panel.
 */
export function fadeBandAlphas(steps = SCROLL_FADE_BANDS): number[] {
  const count = Math.max(2, Math.round(steps));
  return Array.from({ length: count }, (_, index) => {
    const t = (index + 1) / count;
    const ramp = Math.min(1, Math.max(0, (t - 0.42) / 0.33));
    return Math.round(ramp * ramp * 1000) / 1000;
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
