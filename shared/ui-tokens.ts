/**
 * Line tokens. Graphite surfaces; peril tints identify avatars and instruments.
 * Markets reserves yellow for its hero trigger numeral.
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
  divider: "rgba(169,180,194,0.10)",
  avatarFill: { rain: "#1E3550", snow: "#2E3644", wind: "#1B3A36", heat: "#432A26", cold: "#2A3052" },
  radius: { pill: 999, tile: 16, group: 20, hero: 24 },
  type: {
    heroNumeral: { fontSize: 52, lineHeight: 56, fontWeight: "750", letterSpacing: -1.6 },
    heroUnit: { fontSize: 22, fontWeight: "600" },
    sectionTitle: { fontSize: 19, fontWeight: "700", letterSpacing: -.3 },
    rowName: { fontSize: 16, fontWeight: "650" },
    rowFigure: { fontSize: 16, fontWeight: "650" },
    cardTitle: { fontSize: 17, fontWeight: "650" },
    statValue: { fontSize: 19, fontWeight: "650", letterSpacing: -.3 },
    label: { fontSize: 13, fontWeight: "400" },
    tileLabel: { fontSize: 13, fontWeight: "600" },
    cta: { fontSize: 16, fontWeight: "700" },
  },
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
  springDamping: 18,
  springStiffness: 260,
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
