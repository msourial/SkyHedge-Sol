# Problem / solution

## Problem

Weather decides whether a flight leaves, a crane lifts, a haul road stays open, an outdoor wedding happens, or a harvest pays. Traditional weather cover is slow, paperwork-heavy, sold in large minimum sizes, and out of reach for most small operators. When a storm hits, the delay is not just the weather — it is claims, adjusters, and disputed outcomes.

## Solution

SkyHedge sells **parametric weather protection**: a fixed payout that triggers automatically when public weather data crosses a published threshold. The Seeker demo is New York rain. Protect shows an expiry chain. **Nov 1 · W** is the weekly date. One trigger row is priced from the terms already on that Devnet market. Coverage in the demo is **100 SKYT**.

- **Instant** — pick the expiry, read the priced row, approve from the phone.
- **Accessible** — Solana Mobile Wallet Adapter + Phantom; keys stay in the wallet.
- **Fractional** — 50 / 100 / 250 / Max SKYT on Devnet.
- **Verifiable** — Anchor program, per-market vaults, NOAA evidence for that expiry, Explorer links.

Settlement uses NOAA’s final data after the expiry. Incomplete or flagged days are rejected, not replaced with a guess. If valid data never arrives by the deadline, the market is marked DataUnavailable and the premium can be reclaimed.
