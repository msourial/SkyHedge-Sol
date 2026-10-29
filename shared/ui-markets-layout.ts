import { lineMotion } from "./ui-tokens.ts";
/** Legacy web geometry. Native v4 geometry is defined below. */
export const marketsLayout = {
  header: 56, target: 48, margin: 16,
  hero: { height: 336, top: 16, content: 152, beforeStats: 16, stats: 56, beforeCta: 16, cta: 56, bottom: 24, instrumentWidth: 56, instrumentHeight: 128, instrumentScale: 128 / 136, windInstrumentScale: 56 / 112, textX: 88, lineStart: 8, lineEnd: 80 },
  card: { width: 174, height: 224, gap: 12, radius: 14, padding: 12, bodyY: 64, footerY: 184, lineStart: -6, lineEnd: 48, instrumentScale: .75, windInstrumentScale: 44 / 112 },
  row: 64, cityRow: 72, cityPanel: 200,
  zone: { above: 24, below: 8, fontSize: 13, lineHeight: 18 },
} as const;
export const legacyMarketsMotion = { heroLine: 420, numeral: 160, card: 200, stagger: 40, maxSteps: 6, cardLine: 320, city: 160, pressIn: 90, pressOut: 140, pressScale: .98, rise: 8 } as const;

/** Approved native v4 geometry. Legacy card geometry above is retained for web. */
export const marketsV4Layout = {
  header: 56, cityPill: 44, covers: 64, tile: 88, tileGap: 8,
  heroSkeleton: 340, heroPadding: 16, heroAvatar: 44,
  row: 72, avatar: 40, dividerInset: 66, target: 48,
  strike: 36, cta: 52, tab: 80,
} as const;
export const marketsMotion = {
  ...legacyMarketsMotion, numeral: lineMotion.stepMs, stagger: 30, city: 200,
  pressIn: lineMotion.pressMs, pressOut: lineMotion.pressMs, pressScale: lineMotion.pressScale,
} as const;
