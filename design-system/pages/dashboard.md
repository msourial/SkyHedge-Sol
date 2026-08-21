# Dashboard Page — Design Contract

> **LOGIC:** This file overrides `design-system/skyhedge/MASTER.md` for the dashboard page.
> Source of direction: frontend-design skill two-pass review (Pass 1 plan, Pass 2 critique).
> Reference: Skyfall dashboard IA (sticky header + city search + 4 tabs).

---

**Project:** SkyHedge
**Page:** Dashboard (`/` with `?tab=` + `?city=`)
**Audience:** Weather-derivative hedgers (farmers, supply chain) and liquidity providers
**Dials:** Variance 7/10 | Density 8/10

---

## Design Thesis

The page is a **weather-derivative terminal**: deep abyss navy, sky-blue signal, mono numerals for every measurement. The subject's own instruments (rain gauges, mm thresholds, payout odds) are the visual vocabulary. One signature element, everything else quiet.

## Token System (fixed, do not drift)

| Role | Value | Notes |
|------|-------|-------|
| Background | `#050B14` | abyss navy |
| Surface 1 | `#0A1220` | cards |
| Surface 2 | `#0E1A2E` | raised/nested |
| Identity | `#38BDF8` | sky signal (never acid green) |
| Success | `#22C55E` | payout/positive only |
| Warning | `#F59E0B` | watch/amber only |
| Destructive | `#EF4444` | errors |
| Border | `#1C2A3F` | hairlines |
| Text | `#F1F5F9` / muted `#94A3B8` / faint `#64748B` | 4.5:1 min |

**Type:** Display = Space Grotesk (headlines only, restraint). Body = Inter. Data = JetBrains Mono (all numerals, prices, mm, %, APY, addresses).

## Signature Element: The mm-Odds Gauge

One memorable element per trading view: a vertical mm scale with a probability needle — big mono numeral (`72.4%`) beside a thin vertical rule with a marker at the live strike threshold vs climatological normal. Used ONLY in the Trading tab weather/market card. Everything else stays disciplined.

## Layout Contract

```
┌──────────────────────────────────────────────────────────────┐
│ sticky header: logo · city search · net pill · wallet        │
├──────────────────────────────────────────────────────────────┤
│ tabs: TRADING | PORTFOLIO | COMMUNITY | AI ASSISTANT         │
├────────────────────────────────────────┬─────────────────────┤
│ main column (7–8 cols)                 │ right rail (4–5)    │
│ · trading: weather card + gauge,       │ · market status     │
│   canvas trend chart (1D/7D/30D/90D),  │ · persona panel     │
│   options chain table, trade ticket    │   (AI stats)        │
│ · portfolio: stat cards, table,        │                     │
│   detail modal                         │                     │
│ · community: pools, governance         │                     │
│ · ai: chat, insights, accuracy         │                     │
└────────────────────────────────────────┴─────────────────────┘
```

- Tabs read city context via `?city=` (Trading) and persist `?tab=` in the URL.
- Mobile: rail collapses under main; tabs scroll horizontally; no horizontal page overflow (375px gate).
- Chain table keeps internal scroll (`min-w-[900px]` inside `overflow-x-auto` Card) — never page scroll.

## Rules

- All numerals in JetBrains Mono. All actions in active voice ("Open call chain", not "Submit").
- One action name end-to-end: the button that says "Open call chain" produces the toast "Call chain opened".
- Empty states are invitations with a CTA, never gray voids.
- Errors never apologize; they say what failed and how to fix it.
- `cursor-pointer` on all clickables, 150–300ms transitions, visible focus rings, `prefers-reduced-motion` respected.
- Press states: primary/success `translateY(1px)`, ghost gets `--identity-dim` tint.
- No emojis as icons (Lucide only). No pure `#000000` (OLED smear).

## Anti-Patterns (do not use)

- ❌ Acid-green-on-black (template default) — identity is sky blue
- ❌ Numbered markers 01/02/03 unless a real sequence
- ❌ Scattered animations; one orchestrated moment max
- ❌ Light mode default
- ❌ Emojis as icons, missing cursor, layout-shifting hovers