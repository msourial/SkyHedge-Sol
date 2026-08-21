# SkyHedge — Master Design System

Source: ui-ux-pro-max design database (dark-mode style, fintech color guidance, chart + UX rules),
synthesized with the locked product direction: **institutional dark + weather atmosphere, sky/cyan
identity, green reserved for success, Space Grotesk / Inter / JetBrains Mono**.

## Style: Dark Mode (OLED) + weather atmosphere

- Deep storm-navy base; surfaces layered by elevation, never pure black on pure black.
- Atmosphere: radial sky-cyan glows at very low opacity (≤ 8%) behind hero zones; subtle grid/noise
  overlay. Atmosphere must never reduce text contrast below the rules below.
- Minimal glow on identity color only (focus rings, live status pulse). No neon everywhere.
- All transitions 150–300ms, ease-out; exit faster than enter. `prefers-reduced-motion` respected.

## Color tokens (dark only)

| Token | Value | Usage |
|---|---|---|
| `--background` | `#050B14` | app background (storm navy) |
| `--surface-1` | `#0A1220` | cards, panels |
| `--surface-2` | `#0E1A2E` | elevated: modals, dropdowns, ticket panel |
| `--foreground` | `#F1F5F9` | primary text (contrast ≥ 4.5:1 on all surfaces) |
| `--muted-foreground` | `#94A3B8` | secondary text (contrast ≥ 3:1) |
| `--faint` | `#64748B` | captions, placeholders only |
| `--border` | `#1C2A3F` | hairline borders/dividers (visible in dark) |
| `--identity` | `#38BDF8` | sky-400 — brand, links, active nav, focus ring, index values |
| `--identity-deep` | `#0EA5E9` | sky-600 — hover on identity, gradients |
| `--identity-dim` | `rgba(56,189,248,0.12)` | identity tint fills/badges |
| `--success` | `#22C55E` | success states, confirmed tx, payouts, DATA_AGREEMENT |
| `--success-dim` | `rgba(34,197,94,0.12)` | success tint |
| `--warning` | `#F59E0B` | settling/pending states, threshold reference lines |
| `--destructive` | `#EF4444` | errors, DATA_UNAVAILABLE, put-side accents at reduced saturation |
| `--ring` | `#38BDF8` | focus ring |

Rules: green is **never** decorative brand color anymore — only success/positive semantics.
Cyan is the brand. Amber for pending/warning. Red for errors only.

## Typography

| Role | Font | Usage |
|---|---|---|
| Display/headings | **Space Grotesk** 500–700 | h1–h3, hero numbers, city names |
| Body | **Inter** 400–600 | paragraphs, labels, buttons |
| Data/mono | **JetBrains Mono** 400–600 | numbers, mm values, addresses, premiums, table cells |

Scale: Display 32–40 / H1 24 / H2 18 / body 14–16 / caption 11–12 (uppercase, +0.08em tracking for labels).
Google Fonts import in `index.css`. Numbers always mono (tabular alignment in tables/chains).

## Components & patterns

- Cards: `surface-1`, 12px radius, hairline `border`, no heavy shadow; hover = border-identity + translateY(-1px).
- Buttons: primary = identity bg / dark text; ghost = hairline border, hover border-identity; disabled = 40% opacity, non-interactive. All buttons `cursor-pointer`, focus-visible ring.
- Inputs: `surface-1` bg, hairline border, focus = identity border + 3px identity/20% ring. Always a visible `<label>` (never placeholder-only).
- Badges/pills: tint bg + colored text, mono 11px uppercase.
- Skeletons for all async loads (no frozen UI, no bare spinner screens).
- Toasts for tx lifecycle: pending → confirmed (explorer link) / error.
- Empty states: icon + one-line explanation + CTA where relevant.

## Data viz (charts.csv guidance)

- Rainfall trend/history: **bar chart** (daily/window mm) + cumulative line overlay + amber dashed
  threshold reference line. Value color: identity cyan; positive/negative verdicts green/red.
- Provide numeric summary next to every chart (a11y fallback = data table semantics).
- No streaming/canvas needed at this data volume; recharts is fine.

## UX rules (ux-guidelines.csv, HIGH severity first)

1. Loading: skeleton or spinner feedback on every async operation — never blank/frozen UI.
2. Forms: label every input; validate on blur; submit feedback = loading → success/error state.
3. Touch/click targets ≥ 40px; all clickable elements `cursor-pointer` with 150–300ms hover feedback.
4. Focus states visible for keyboard nav on every interactive element.
5. Text contrast: primary ≥ 4.5:1, secondary ≥ 3:1 on dark surfaces; verify per component.
6. Responsive checks: 375 / 768 / 1024 / 1440.
7. Reduced motion: disable non-essential animation.
8. Icons: Lucide SVG only — no emojis as structural icons.

## Anti-patterns to avoid

- Light-mode defaults; washed-out gray body text on dark; borders invisible in dark.
- Emoji as icons; heavy box-shadows; neon glow everywhere; layout-shifting hover transforms.
- Raw machine text shown to users (slugs, hashes without truncation+copy).
