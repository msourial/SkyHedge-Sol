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
