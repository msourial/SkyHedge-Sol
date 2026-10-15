/**
 * "Storm Glass" brand system: navy canvas with graphite panes,
 * one signal colour (glacier blue = rain + primary action), gold reserved for
 * money/payout, amber only for soon/weather-alert status and the Devnet pill,
 * mint only for verified/live state. Glow is reserved for status and
 * the selected control — never ambient decoration on every surface.
 * Visual references: docs/mockups/storm-glass-markets.png (Markets);
 * Protect follows the same Storm Glass tokens (coverage ticket + Step 3 review).
 *
 * Color / glass / spacing tokens are shared with the web client via
 * `shared/storm-glass.ts`. Font file names below are Expo-specific.
 */
export {
  C,
  glass,
  space,
  motion,
  radius,
  MIN_TOUCH,
  MIN_FONT,
} from "../../shared/storm-glass.ts";

import { C } from "../../shared/storm-glass.ts";
import type { TextStyle } from "react-native";

/** Soft rim light for live/soon status — concept markets stay flat. */
export const statusGlow = (color: string, concept = false) => (concept ? "none" : `0px 0px 12px ${color}40`);

/** Accent rim for a focal glass card (hero market, live window). */
export const accentGlow = (color: string) => `0px 0px 26px ${color}22, 0px 10px 28px rgba(0,0,0,0.45)`;

export const F = {
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemi: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
  heading: "InterTight_600SemiBold",
  headingBold: "InterTight_700Bold",
  mono: "monospace",
} as const;

/** Amount figures (mutable TextStyle so fontVariant stays assignable). */
const amountXL = { fontFamily: F.mono, fontWeight: "700", fontSize: 48, lineHeight: 56, letterSpacing: -1, fontVariant: ["tabular-nums"] } satisfies TextStyle;
const amountL = { fontFamily: F.mono, fontWeight: "700", fontSize: 40, lineHeight: 48, letterSpacing: -0.8, fontVariant: ["tabular-nums"] } satisfies TextStyle;
const amountM = { fontFamily: F.mono, fontWeight: "700", fontSize: 32, lineHeight: 40, letterSpacing: -0.5, fontVariant: ["tabular-nums"] } satisfies TextStyle;
const amountS = { fontFamily: F.mono, fontWeight: "700", fontSize: 24, lineHeight: 32, fontVariant: ["tabular-nums"] } satisfies TextStyle;

/** Enterprise type scale: minimum 12sp for any readable text (UI UX Pro Max rule 6). */
export const type = {
  display: { fontFamily: F.headingBold, fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  title: { fontFamily: F.headingBold, fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  heading: { fontFamily: F.heading, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: F.body, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: F.bodySemi, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: F.body, fontSize: 12, lineHeight: 18 },
  overline: { fontFamily: F.bodySemi, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: "uppercase" as const },
  figure: { fontFamily: F.headingBold, fontSize: 28, lineHeight: 34, fontVariant: ["tabular-nums" as const] },
  /** Landing hero. */
  hero: { fontFamily: F.headingBold, fontSize: 40, lineHeight: 46, letterSpacing: -1.2 },
  /** Card titles. */
  cardTitle: { fontFamily: F.headingBold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  /** Emphasised row / item names. */
  bodyStrong: { fontFamily: F.bodySemi, fontSize: 15, lineHeight: 22 },
  /** Lead paragraph under a screen title. */
  lead: { fontFamily: F.body, fontSize: 15, lineHeight: 22 },
  /** Amount figures: tabular, tight tracking, mono. XL = hero money, L = key figures, M = split cells. */
  amountXL,
  amountL,
  amountM,
  amountS,
  unit: { fontFamily: F.mono, fontSize: 13, lineHeight: 18, letterSpacing: 0.2 },
} as const;

/** Opaque elevation for non-glass surfaces; Storm Glass panes use `glass` instead. */
export const elevation = {
  flat: { backgroundColor: C.canvas },
  card: { backgroundColor: C.surfaceRaised, borderColor: C.border, borderWidth: 1 },
  raised: { backgroundColor: C.surfaceRaised, borderColor: C.border, borderWidth: 1 },
} as const;
