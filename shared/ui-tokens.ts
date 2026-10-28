/**
 * Line tokens. Surfaces stay graphite. Tints exist only for instrument fills
 * and the 8px peril dot. Yellow is the line, a payout figure, and Paid out.
 */
export const lineTokens = {
  bg: "#0B1220",
  surface1: "#141B28",
  surface2: "#1C2433",
  bgRaised: "#232C3B",
  fg: "#F2F5F8",
  fg2: "#A9B4C2",
  glacier: "#7CC4FF",
  onGlacier: "#0B1220",
  slicker: "#F2C230",
  tick: "#5B6878",
  dryFill: "#3A4556",
  dryText: "#7A8696",
  meniscus: "#B5E0FF",
  rain: "#7CC4FF",
  snow: "#DCE6F0",
  wind: "#86D1B5",
  heat: "#E8795A",
  cold: "#A8B8FF",
} as const;

export const lineMotion = {
  ease: "cubic-bezier(.23,1,.32,1)",
  pressMs: 150,
  pressScale: 0.96,
  sheetInMs: 320,
  sheetOutMs: 200,
  fillMs: 640,
  lineMs: 320,
  stepMs: 240,
  swapMs: 120,
  tickStaggerMs: 8,
} as const;

export const SKYT_BASE = 1_000_000n;
export const COVER_SIZES = [50, 100, 250] as const;
/** Protect bar height before safe-area insets, shared by both renderers. */
export const PROTECT_BAR_HEIGHT = 88;
export const footnoteSpacing = { above: 12, below: 16 } as const;
/** Per market, from the program cap. Chips above the remaining room are disabled. */
export const MARKET_CAP_SKYT = 500;
