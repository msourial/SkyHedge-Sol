/** SkyHedge's own dark palette, with restrained Solana-inspired accents. */
export const C = {
  canvas: "#080B14",
  surface: "#111827",
  surfaceRaised: "#182235",
  mutedSurface: "#202A3D",
  ink: "#F6F8FC",
  muted: "#A7B3C8",
  quiet: "#7F8CA4",
  border: "#2A354A",
  rain: "#70D6FF",
  rainSoft: "#173A50",
  mint: "#32E6A1",
  mintSoft: "#123E34",
  violet: "#9B8CFF",
  violetSoft: "#302853",
  amber: "#F5C66D",
  amberSoft: "#3C2B1B",
  coral: "#FF8C91",
  redSoft: "#3B222D",
  white: "#F6F8FC",
  actionText: "#06271C",
  // Existing screen names keep the migration small while all values resolve to semantic tokens.
  blue: "#70D6FF",
  blueSoft: "#173A50",
  green: "#32E6A1",
  greenSoft: "#123E34",
  purple: "#9B8CFF",
  purpleSoft: "#302853",
  red: "#FF8C91",
  field: "#302853",
  fieldText: "#F6F8FC",
} as const;

export const F = {
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemi: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
  heading: "SpaceGrotesk_600SemiBold",
  headingBold: "SpaceGrotesk_700Bold",
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

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/** Elevation is expressed by surface step + hairline, not glow. */
export const elevation = {
  flat: { backgroundColor: C.canvas },
  card: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1 },
  raised: { backgroundColor: C.surfaceRaised, borderColor: C.border, borderWidth: 1 },
} as const;

export const MIN_TOUCH = 48;
export const MIN_FONT = 12;
