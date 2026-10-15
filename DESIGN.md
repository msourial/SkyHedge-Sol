# SkyHedge product design system

This is the authoritative design reference for the SkyHedge web application. It matches the Seeker app **Storm Glass** direction. Shared color and spacing tokens live in `shared/storm-glass.ts` (consumed by `mobile/src/theme.ts` and mirrored as CSS variables in `client/src/index.css`).

## Product character

SkyHedge is a calm, credible weather-risk product: graphite panes over a navy canvas, one glacier-blue signal colour, and amber reserved for alerts and Devnet. Never describe the product as insurance — use protection, coverage, or hedge.

## Design direction

`[PLAN:@DESIGN|type=weather_risk_application] palette=storm_glass accent=glacier_blue typography=Inter_Tight_headings+Inter_body layout=compact_rail_and_map_workspace mood=frosted_graphite density=balanced exclude=neon,ambient_glow,purple_theme,uppercase_heavy,insurance_copy responsive=mobile_first`

## Typography

- **Inter Tight** for headings and display (`--font-display`).
- **Inter** for body, controls, and labels (`--font-body`).
- **IBM Plex Mono** for wallet addresses, hashes, program IDs, and transaction signatures.
- Headings use 700 weight with tight tracking. Body copy uses 400 or 500. Controls use 600.
- Customer inputs are at least 16px to prevent mobile browser zoom.

## Customer theme (Storm Glass)

| Token | Value | Use |
| --- | --- | --- |
| Background / canvas | `#0B1220` | Application canvas |
| Surface raised / cards | `#1C2433` | Graphite panels and cards |
| Surface | `#141B28` | Quiet supporting areas / fields |
| Foreground / ink | `#F2F5F8` | Primary text |
| Muted | `#A3AEBC` | Secondary text |
| Quiet / faint | `#98A3B0` | Tertiary text (WCAG AA on canvas) |
| Border | `#2A3444` | Dividers and controls |
| Rain / identity | `#7CC4FF` | Primary actions, rain data, selected nav |
| Action text | `#04131F` | Text on glacier-blue buttons |
| Success / mint | `#34D399` | Validated and live states |
| Warning / amber | `#FFB020` | Alerts, soon status, Devnet badges only |
| Payout gold | `#F5B841` | Money figures (distinct from alert amber) |
| Error / coral | `#F2787D` | Failed and unavailable states |

Cards use ~14px corners, a one-pixel border, and restrained elevation. Glow is reserved for status and selection — never ambient decoration on every surface.

## Builder theme

Builder mode uses the same Storm Glass canvas and glacier accent so the product reads as one system. Technical content may use IBM Plex Mono. Structure, spacing, focus styles, and status meanings match customer mode.

## Navigation and responsive behavior

- Desktop (1024px and wider): compact icon rail with Markets, Protect, Liquidity, Portfolio, Evidence, and a separated Builder entry; map-led catalog uses a floating searchable location list.
- Mobile and tablet: compact header and fixed bottom navigation for Markets, Protect, Portfolio, Evidence, and More. The More drawer contains Liquidity and Builder mode.
- Markets landing hero: “Weather risk, settled on-chain.” with a phone mockup and three feature cards (Markets by city, Peril picker, Paid from live weather data).
- All interactive targets are at least 44×44px. Respect safe-area insets and 200% zoom. Never require horizontal page scrolling.
- Preserve `tab` and `city` URL state.

## Components

- Page headers: direct title and one concise explanatory sentence. Markets uses the landing hero instead of the generic page header.
- Panels: graphite Storm Glass surfaces; consistent radius and 20–24px padding.
- Status chips: sentence case with semantic color and subtle tint. Amber only for alerts / Devnet / soon.
- Forms: persistent sentence-case labels, 16px controls, inline help/errors, explicit units, and full-width mobile actions.
- Maps: compact context panels secondary to the form; reference point only, never a coverage boundary.
- Test environment: concise expandable notice with amber treatment. Do not dominate every screen.
- Technical details: hide SKYT, PDAs, IDs, authorities, and raw diagnostics in Builder mode or expandable technical details.

## Content principles

Lead with ordinary customer terms: Protection amount, Preview premium, Potential payout, Evidence status, and Test environment. Never fabricate balances, markets, weather observations, transactions, or claims. State unavailable and pending conditions plainly and explain the next prerequisite. Never use the word insurance.

## Accessibility and motion

- WCAG AA contrast; visible 2px focus rings.
- Semantic headings, persistent labels, status announcements, and keyboard-operable drawers.
- Respect `prefers-reduced-motion`; motion is limited to short, functional state transitions.
- Use `font-display: swap` through the self-hosted font package to avoid invisible text.
