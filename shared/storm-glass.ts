/**
 * Storm Glass tokens shared by the Seeker app and the web client.
 * Platform-specific font file names and RN TextStyle scales live in mobile/src/theme.ts;
 * the web client maps these hex values onto CSS custom properties in client/src/index.css.
 */
export const C = {
  canvas: "#0B1220",
  surface: "#141B28",
  surfaceRaised: "#1C2433",
  mutedSurface: "#243044",
  ink: "#F2F5F8",
  muted: "#A3AEBC",
  /** Secondary labels — kept ≥4.5:1 on canvas for WCAG AA small text. */
  quiet: "#98A3B0",
  /** Marketing body on navy — landing floor (≥ muted) for long-form copy. */
  bodyOnNavy: "#A9B4C7",
  border: "#2A3444",
  rain: "#7CC4FF",
  /** Lighter rain for pressed/selected text on dark panes. */
  rainBright: "#A8D9FF",
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
  coralBright: "#FFD9DB",
  white: "#F2F5F8",
  actionText: "#04131F",
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

/**
 * Isometric umbrella glyph (source of truth: mobile BrandMark / icon-v1).
 * Keep panel fills here so web + native stay identical.
 */
export const brandMark = {
  panel1: "#7BC3F0",
  panel2: "#9FD5F5",
  panel3: "#4F96D6",
  panel4: "#3A78B5",
  handle: "#7BC3F0",
  tip: "#F5B342",
  /** App-icon / favicon tile behind the glyph. */
  tile: "#12151A",
  tileBorder: "rgba(124,196,255,0.35)",
  tileGlow: "0px 0px 14px rgba(124,196,255,0.35)",
  /** Cropped viewBox matching BrandMark.tsx */
  viewBox: "236 190 552 590",
} as const;

export const glass = {
  fill: "rgba(28,36,51,0.92)",
  fillRaised: "rgba(28,36,51,0.98)",
  fillField: "rgba(28,36,51,0.72)",
  border: "rgba(124,196,255,0.16)",
  borderStrong: "rgba(124,196,255,0.28)",
  edge: "rgba(190,225,255,0.35)",
  sheen: ["rgba(40,52,68,0.70)", "rgba(28,36,51,0.62)", "rgba(11,18,32,0.70)"] as const,
  sheenBlur: ["rgba(40,52,68,0.45)", "rgba(28,36,51,0.35)", "rgba(11,18,32,0.50)"] as const,
  shadow: "0px 10px 28px rgba(0,0,0,0.45)",
  fieldShadow: "0px 8px 24px rgba(0,0,0,0.40)",
  radius: 24,
} as const;

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 40 } as const;

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

export const MIN_TOUCH = 48;
export const MIN_FONT = 12;
