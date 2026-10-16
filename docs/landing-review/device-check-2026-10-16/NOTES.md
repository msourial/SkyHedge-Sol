# Device check 2026-10-16 — step 1 in progress

## Done
- SHA-256 verified: `6becdfc300f917923e1e2f50d95839d384ddc62514249aba72cbe691e4ad954d`
- `adb install -r` Success on SM02G406197714
- Package was `enabled=0` after install → `pm enable com.skyhedge.mobile` applied
- Uninstall + reinstall also Success; still enabled

## Blocked
- Device locked: `mScreenLocked=true`, `mDreamingLockscreen=true`, focus=`NotificationShade`, app=`FallbackHome`
- `am start …MainActivity` → Error type 3 / ATM result -92 (activity unavailable until credential unlock / Direct Boot)
- Notification shade stuck expanded; `cmd statusbar collapse` / BACK / HOME / SystemUI kill not permitted from shell
- Screencaps of Markets / Protect / Wallet not taken yet
- Web baseline for compare: https://skyhedge.app (Storm Glass waitlist; Markets→Protect→Wallet narrative; Des Moines Live; Devnet honesty)

## Web compare (skyhedge.app) — done without device

- Live waitlist Storm Glass hero OK; Devnet honesty copy present; no “insurance”.
- How-it-works: Markets → Protect → Wallet narrative matches demo script.
- Live markets: Des Moines / NY / Miami / Chicago Live; Toronto Soon.
- Hero phone loads `/mockups/landing/protect.png` (1080×2300); dark Storm Glass UI reads nearly empty at a glance — step 3 recapture should improve Protect (priced quote) + Wallet (connected).
- Waitlist success/already copy not yet deployed (staged locally for step 6).

## Need
- Physical unlock: dismiss notification shade, enter PIN. Unlock watcher running; will launch app when `mScreenLocked=false`.
