# SkyHedge product design system

This is the authoritative design reference for the SkyHedge web application. It replaces the retired cyberpunk and trading-terminal directions.

## Product character

SkyHedge is a calm, credible climate-protection service for agricultural customers. The customer experience should feel like modern financial infrastructure: clear, trustworthy, restrained, and easy to use without blockchain knowledge. Builder mode is a separate technical workspace for protocol administration and verification.

## Design direction

`[PLAN:@DESIGN|type=climate_protection_application] palette=signal_dark accent=rain_blue typography=IBM_Plex_Sans display=same_as_body layout=compact_rail_and_map_workspace mood=professional_minimal density=balanced exclude=neon,glow,grid,cyberpunk,uppercase_heavy,decorative_gradients responsive=mobile_first`

## Typography

- IBM Plex Sans is the only customer-facing typeface. Use it for headings, body copy, controls, labels, financial values, and navigation.
- IBM Plex Mono is reserved for wallet addresses, hashes, program IDs, and transaction signatures.
- Headings use 600 weight with natural tracking. Body copy uses 400 or 500. Controls use 600.
- Customer inputs are at least 16px to prevent mobile browser zoom.

## Customer theme

| Token | Value | Use |
| --- | --- | --- |
| Background | `#080B14` | Dark application canvas |
| Surface | `#111827` | Elevated panels and cards |
| Surface muted | `#182235` | Quiet supporting areas |
| Foreground | `#F6F8FC` | Primary text |
| Muted | `#A7B3C8` | Secondary text |
| Border | `#2A354A` | Dividers and controls |
| Primary | `#70D6FF` | Rain data, actions, and selected navigation |
| Primary hover | `#B6EBFF` | Interactive hover |
| Success | `#32E6A1` | Validated and finalized states |
| Warning | `#F5C66D` | Pending evidence and test notices |
| Error | `#FF8C91` | Failed and unavailable states |

Cards use 12px corners, a one-pixel border, and restrained elevation. Ambient blue/violet color is limited to app chrome, selected state, and map context; it is never a substitute for hierarchy.

## Builder theme

Builder mode uses a restrained dark navy canvas (`#081521`) with raised surfaces (`#0F2232`), light text (`#F4F7F8`), muted blue-gray text (`#A9B8C2`), and sky-blue actions (`#67C1E5`). Technical content may use IBM Plex Mono. The structure, spacing, focus styles, and status meanings remain identical to customer mode.

## Navigation and responsive behavior

- Desktop (1024px and wider): compact icon rail with Markets, Protect, Liquidity, Portfolio, Evidence, and a separated Builder entry; map-led catalog uses a floating searchable location list.
- Mobile and tablet: compact header and fixed bottom navigation for Markets, Protect, Portfolio, Evidence, and More. The More drawer contains Liquidity and Builder mode.
- All interactive targets are at least 44×44px. Respect safe-area insets and 200% zoom. Never require horizontal page scrolling.
- Preserve `tab` and `city` URL state.

## Components

- Page headers: direct title and one concise explanatory sentence. Avoid decorative eyebrows.
- Panels: dark customer surfaces or navy Builder surfaces; consistent 12px radius and 20–24px padding.
- Status chips: sentence case with semantic color and subtle tint. Never use color alone.
- Forms: persistent sentence-case labels, 16px controls, inline help/errors, explicit units, and full-width mobile actions.
- Maps: compact context panels secondary to the form; reference point only, never an coverage boundary.
- Test environment: concise expandable notice. Do not dominate every screen.
- Technical details: hide SKYT, PDAs, IDs, authorities, and raw diagnostics in Builder mode or expandable technical details.

## Content principles

Lead with ordinary customer terms: Protection amount, Preview premium, Potential payout, Evidence status, and Test environment. Never fabricate balances, markets, weather observations, transactions, or claims. State unavailable and pending conditions plainly and explain the next prerequisite.

## Accessibility and motion

- WCAG AA contrast; visible 2px focus rings.
- Semantic headings, persistent labels, status announcements, and keyboard-operable drawers.
- Respect `prefers-reduced-motion`; motion is limited to short, functional state transitions.
- Use `font-display: swap` through the self-hosted font package to avoid invisible text.
