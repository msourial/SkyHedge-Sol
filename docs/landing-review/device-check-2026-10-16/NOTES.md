# Device check 2026-10-16

## Done
- SHA-256 verified: `6becdfc300f917923e1e2f50d95839d384ddc62514249aba72cbe691e4ad954d`
- APK installed on Seeker `SM02G406197714` (`com.skyhedge.mobile`)
- Device unlocked; MainActivity focused
- Screens: `markets.png`, `protect.png`, `wallet.png`
  - Markets: Des Moines **Sales closed**; CHI/NYC/MIA Ready to open; Toronto Opens soon
  - Protect: sales ended; Protect disabled; ticket Oct 14–18 ≥50 mm
  - Wallet: Connected; position waiting on weather (window ends Oct 19 UTC)
- Waitlist `already_subscribed` UX: commit `09df16a`, pushed, prod deployed

## Seed + priced Protect (same day)
- Market 2 create/fund/open finalized — see `docs/devnet-ops.md` (sigs `3BKexk…`, `5Uqswf…`, `5Gbdau…`).
- Protect quote-gate: price without wallet; CTA still Connect. Captures `60-protect.png`–`62-protect-lower.png`: **You pay 9.05** / get 100 SKYT, Oct 19–23, ≥50 mm.
- Markets: Des Moines **Live** (`59-markets-live.png`).

## Still open
- Marketing mockups (step 4) + production screenshots (step 5) on the demo plan.
- Optional: Phantom purchase on a wallet without an existing Des Moines position.
- Encode dashboard / GitHub Release as before.
