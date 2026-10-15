/**
 * "Storm Glass" brand system: navy canvas with graphite panes,
 * one signal colour (glacier blue = rain + primary action), gold reserved for
 * money/payout, amber only for soon/weather-alert status and the Devnet pill,
 * mint only for verified/live state. Glow is reserved for status and
 * the selected control — never ambient decoration on every surface.
 * Visual references: docs/mockups/storm-glass-markets.png (Markets);
 * Protect follows the same Storm Glass tokens (coverage ticket + Step 3 review).
 */
export const C = {
  canvas: "#0B1220",
  surface: "#141B28",
  surfaceRaised: "#1C2433",
  mutedSurface: "#243044",
  ink: "#F2F5F8",
  muted: "#A3AEBC",
  quiet: "#7D8896",
  border: "#2A3444",
  rain: "#7CC4FF",
  rainSoft: "#10283A",
  mint: "#34D399",
  mintSoft: "#0F2E24",
  violet: "#7CC4FF",
  violetSoft: "#10283A",
  /** Soon / weather-alert status and Devnet pill only — not money. */
  amber: "#FFB020",
  amberSoft: "#2E2414",
  coral: "#F2787D",
  redSoft: "#3B222D",
  white: "#F2F5F8",
  actionText: "#04131F",
  // Existing screen names keep the migration small while all values resolve to semantic tokens.
  blue: "#7CC4FF",
  blueSoft: "#10283A",
  green: "#7CC4FF",
  greenSoft: "#10283A",
  purple: "#A3AEBC",
  purpleSoft: "#243044",
  red: "#F2787D",
  field: "#1C2433",
  fieldText: "#F2F5F8",
  /** Money / payout figures — distinct from alert amber. */
  payout: "#F5B841",
  payoutSoft: "#2E2414",
} as const;

/** Frosted-pane recipes used by GlassCard, Markets search, and selected chips. */
export const glass = {
  fill: "rgba(28,36,51,0.92)",
  fillRaised: "rgba(28,36,51,0.98)",
  fillField: "rgba(28,36,51,0.72)",
  border: "rgba(124,196,255,0.16)",
  borderStrong: "rgba(124,196,255,0.28)",
  edge: "rgba(190,225,255,0.35)",
  /** Gradient wash when native blur is unavailable. */
  sheen: ["rgba(40,52,68,0.70)", "rgba(28,36,51,0.62)", "rgba(11,18,32,0.70)"] as const,
  /** Lighter wash layered over native BlurView. */
  sheenBlur: ["rgba(40,52,68,0.45)", "rgba(28,36,51,0.35)", "rgba(11,18,32,0.50)"] as const,
  shadow: "0px 10px 28px rgba(0,0,0,0.45)",
  fieldShadow: "0px 8px 24px rgba(0,0,0,0.40)",
  radius: 24,
} as const;

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

/** 4/8pt spacing grid. Every margin, padding and gap in the consumer screens resolves to one of these. */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 40 } as const;

import type { TextStyle } from "react-native";
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

/** Motion tokens. Calm, decelerating; Markets cards rise ~0.7s with 90ms stagger. */
export const motion = {
  fast: 140,
  base: 240,
  slow: 700,
  progress: 900,
  stagger: 90,
  enterOffset: 22,
  pressScale: 0.97,
  spring: { damping: 18, stiffness: 260, mass: 0.9 },
} as const;

export const radius = { sm: 6, md: 10, lg: 14, glass: 24, pill: 999 } as const;

/** Opaque elevation for non-glass surfaces; Storm Glass panes use `glass` instead. */
export const elevation = {
  flat: { backgroundColor: C.canvas },
  card: { backgroundColor: C.surfaceRaised, borderColor: C.border, borderWidth: 1 },
  raised: { backgroundColor: C.surfaceRaised, borderColor: C.border, borderWidth: 1 },
} as const;

export const MIN_TOUCH = 48;
export const MIN_FONT = 12;
