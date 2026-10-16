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

## Demo blocker (honest)
- Des Moines sales closed — Phantom purchase demo needs a new on-chain market (admin wallet).
- Wallet position still usable for settlement/refund story beats.

## Still needs you
- Encode dashboard: confirm solo team
- Anchor Devnet upgrade (permissionless settle/unavailable)
- Create/fund/open new Des Moines (or other) sales window
- Publish GitHub Release (install `gh` or do in browser)
