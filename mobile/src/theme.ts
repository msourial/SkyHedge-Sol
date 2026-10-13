/**
 * "Instrument" brand system: graphite canvas, one signal colour (glacier blue = rain + primary action),
 * gold reserved for money/payout, mint only for verified state. No purple, no glow.
 */
export const C = {
  canvas: "#0B0F14",
  surface: "#11161D",
  surfaceRaised: "#171D26",
  mutedSurface: "#1E2530",
  ink: "#F2F5F8",
  muted: "#A3AEBC",
  quiet: "#7D8896",
  border: "#252D38",
  rain: "#5EC8FF",
  rainSoft: "#10283A",
  mint: "#34D399",
  mintSoft: "#0F2E24",
  violet: "#5EC8FF",
  violetSoft: "#10283A",
  amber: "#F5B841",
  amberSoft: "#2E2414",
  coral: "#F2787D",
  redSoft: "#3B222D",
  white: "#F2F5F8",
  actionText: "#04131F",
  // Existing screen names keep the migration small while all values resolve to semantic tokens.
  blue: "#5EC8FF",
  blueSoft: "#10283A",
  green: "#5EC8FF",
  greenSoft: "#10283A",
  purple: "#A3AEBC",
  purpleSoft: "#1E2530",
  red: "#F2787D",
  field: "#171D26",
  fieldText: "#F2F5F8",
  payout: "#F5B841",
  payoutSoft: "#2E2414",
} as const;

export const F = {
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemi: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
  heading: "Inter_600SemiBold",
  headingBold: "Inter_700Bold",
  mono: "monospace",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

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
} as const;

export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;

/** Elevation is expressed by surface step + hairline, not glow. */
export const elevation = {
  flat: { backgroundColor: C.canvas },
  card: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1 },
  raised: { backgroundColor: C.surfaceRaised, borderColor: C.border, borderWidth: 1 },
} as const;

export const MIN_TOUCH = 48;
export const MIN_FONT = 12;
