# Calm local forecaster — identity pass

> Native execution in this session (no subagents). Checkbox steps track the work.

**Goal:** Give SkyHedge one rain-gauge identity on the Seeker app and `/app`, and make pay versus payout obvious.

**Architecture:** Shared quote math stays in `shared/`. One `RainGauge` on each platform. Customer nav is Markets, Protect, Wallet. Builder stays reachable by URL and a Builder button, not as a fourth tab.

**Tech:** React, React Native SVG, existing NOAA quote terms. Devnet only. No x402 edits. Map WIP files stay uncommitted.

## What the numbers mean

The 50 / 100 / 250 chips are the **protected amount**: what the wallet collects if the trigger hits (`potential_payout`). They are not the price.

`Per 100 SKYT 24.00` is the premium to protect 100 SKYT. Same ceil as the program: `(amount × premiumRateBps + 9_999) / 10_000`. At 2,400 bps that is 24.00 SKYT. The wallet transfers that premium. The 1% protocol fee is carved out of it, not added on top.

`4.1×` is protected amount ÷ premium, truncated to one decimal (100 / 24.00 = 4.166… → 4.1×). Chance is the pinned probability (2,000 bps → 20.0%). Bars, the ladder, and the CTA use only a priced on-chain trigger.

## Tasks

- [ ] Pay/get tests then `shared/pay-get.ts`: pay, get, multiple, chance, CTA, not-triggered line.
- [ ] Gauge component (web SVG, Seeker SVG). Water rises to the selected line. Settlement fill. Reduced motion stops the rise.
- [ ] Tokens: graphite cards, glacier only on water and Open, slicker `#F2C230` only on the selected line and payout figures. Devnet badge is a neutral outline. Inter, Barlow Condensed, IBM Plex Mono. No glow pulse, frosted cards, or tab pill. Connect wallet.
- [ ] Protect: two bars, gauge ladder (unpriced rows collapse), Weekly/Monthly chips, NOAA line, CTA `Protect X SKYT · get Y if ≥T mm`.
- [ ] Markets status Open / Opens &lt;date&gt; / Closed. Mini gauge. Step 1 of 3 on first run only. New York first.
- [ ] Wallet holds My protections. Header no longer clips. Chips clear the bottom nav.
- [ ] Confirm sheet, success gauge, not-triggered line. Landing rain into a gauge and Pick your city.
- [ ] Station strip instead of the hanging map. Screenshots at 393 and desktop, plus adb. Small commits. Do not push.
