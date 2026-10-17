# SkyHedge design system (Seeker app)

Shared color / glass / spacing tokens live in `shared/storm-glass.ts`. The Seeker app re-exports them from `mobile/src/theme.ts` (plus Expo font names and the type scale); motion primitives are in `mobile/src/motion.tsx`. The web client mirrors the same hex values as CSS variables in `client/src/index.css`.
Visual direction: **Storm Glass** (frosted panes over graphite; glow only on status and selection).
Markets reference: `docs/mockups/storm-glass-markets.png`. Protect uses the same Storm Glass tokens (graphite coverage ticket, Step 3 review reason always visible). Broader flows: `~/Documents/Codex/skyhedge-revamp-refs/opendesign/flows-v2.html` (+ `flows-v2-board.png`).

The palette (navy canvas `#0B1220`, graphite cards `#1C2433`, glacier-blue `#7CC4FF`, amber `#FFB020` for alerts/Devnet only, gold for money, mint for verified) and the V1 umbrella logo are unchanged.

## Type scale (`type`, imported as `T`)

| Token | Size / line height | Tracking | Weight | Use |
|---|---|---|---|---|
| `hero` | 40 / 46 | −1.2 | Inter Bold | Landing headline |
| `display` | 32 / 38 | −0.8 | Inter Bold | Screen titles |
| `title` | 24 / 30 | −0.5 | Inter Bold | Status titles, big labels |
| `cardTitle` | 20 / 26 | −0.3 | Inter Bold | Card headings |
| `heading` | 18 / 24 | 0 | Inter SemiBold | Section headings |
| `body` / `lead` | 15 / 22 | 0 | Inter Regular | Paragraphs, row labels |
| `bodyStrong` | 15 / 22 | 0 | Inter SemiBold | Item names, row values, chips |
| `label` | 13 / 18 | 0 | Inter SemiBold | Field labels, links, pills |
| `caption` | 12 / 18 | 0 | Inter Regular | Supporting text (minimum readable size) |
| `overline` | 12 / 16 | +0.8, caps | Inter SemiBold | Section eyebrows |
| `amountXL` | 48 / 56 | −1 | Mono Bold, tabular | Payout / balance hero figures |
| `amountL` | 40 / 48 | −0.8 | Mono Bold, tabular | Trigger figure |
| `amountM` | 32 / 40 | −0.5 | Mono Bold, tabular | "You pay / You get" split |
| `amountS` | 24 / 32 | 0 | Mono Bold, tabular | Counts, position values |
| `unit` | 13 / 18 | +0.2 | Mono | Units next to figures (SKYT, mm) |

Every amount uses `fontVariant: ["tabular-nums"]` so digits don't shift while they animate or update.
No readable text is below 12 (enforced by `theme.test.ts`).

## Spacing (`space`, imported as `S`): 4/8pt grid

`xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32 · xxxl 40`

- Card padding: `lg` (16) on every card. Gap between cards: `lg` (16).
- Section gap (overline above a group): `xl` (24) top, `sm` (8) bottom.
- Row height: 48 minimum (`MIN_TOUCH`). Chips: 52 tall, `sm` gap.
- Inline gaps (icon ↔ text, dot ↔ label): `sm` or `md`.

## Motion (`motion` tokens)

| Token | Value | Where |
|---|---|---|
| `fast` | 140 ms | reserved for micro feedback |
| `base` | 240 ms | screen transition (fade + 10px rise, ease-out cubic) |
| `slow` | 420 ms | card / step enter (fade + rise) |
| `stagger` | 60 ms | delay between successive cards / tracker steps |
| `progress` | 900 ms | step rails and payout tracker fill |
| `pressScale` | 0.97 | press-down scale |
| `spring` | damping 18, stiffness 260, mass 0.9 | press springs |

Primitives (`mobile/src/motion.tsx`), all on React Native `Animated` (no new dependencies):

- `SpringPress`: Pressable with spring press-down; when `selected` flips on it pops 0.94 → 1. Used by coverage chips, region chips, market rows, "Look around first".
- `Enter`: staggered fade + rise on mount. Used by onboarding steps and payout tracker steps.
- `ProgressRail`: animated fill to a 0–1 value. Used by the 3-step bar and the payout tracker.
- `SpringPress` also accepts a `({ pressed }) => style` function for pressed states.
- `ScreenTransition` (`liquid-glass.tsx`): tab change fade + rise, 240 ms ease-out.

### Reduce motion

All primitives, `GlassCard`, `CountUp`, `RainGauge`, the ticker, the landing fade and the receipt check pop read
`useReducedMotion()` (`AccessibilityInfo.isReduceMotionEnabled` + change listener). When it's on, elements render in their
final state with no movement.

## Rules

- Copy and amounts are owned by `consumer-flow.ts` / `ticket.ts`; design passes don't change them.
- Never describe SkyHedge as insurance; use protection, coverage or hedge.
- Don't add hard-coded font sizes or spacings in screens; extend the tokens instead.

## Component states

- **Coverage chips:** 50 / 100 / 250 on row one, Max full-width on row two (app and board match). States: default, pressed (blue tint), selected (blue border + glow), not-enough-balance (amber border, inline amber message under the chips), disabled (dashed, dimmed; Max when the wallet has no SKYT, with an inline note).
- **You pay:** shows the real quote premium only. While pricing: skeleton + spinner. Quote error: "Price unavailable" + retry notice. No open expiry: "Next window opening shortly". Never a fabricated number.
- **Sticky buy button:** "Protect for X SKYT" once a live quote exists; otherwise "Protect", disabled, with the reason as a hint above it.
- **Payout tracker:** shown only when a real position exists (Protect and Wallet). Step dates come from `observationEnd`, the on-chain observation record and `claimDeadline`; steps with no known time show no date. Inactive steps use `C.muted` (well above 4.5:1 on the card).
- **Wallet empty state:** umbrella icon, "No positions yet", and a "Browse markets →" link.
