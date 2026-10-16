# Status report — Encode Checkpoint 1 / mid-submission prep

Branch: `seeker-revamp`  
Date: 2026-10-16  
Repo: `SkyHedge-clock-in-redesign` → `msourial/SkyHedge-Sol`  
Live URL: https://skyhedge.app

## Verdict

Seeker release APK installed and exercised on SM02G406197714. Markets / Protect / Wallet screencaps + bug list committed. Wallet endless “Reading balances…” fixed (error + Retry); APK rebuilt (arm64) and reinstalled. Landing mockups refreshed from marketing captures (Devnet pill off). Waitlist success / already-subscribed UX is **live on production**. Draft GitHub release created (not published). Demo recording checklist is on the branch. **Des Moines sales window is closed** — priced Protect quote and full 2:30 purchase path need a new Devnet market (ask before on-chain seed). Never say insurance; no fake numbers.

## Commits (this session, selected)

| Commit | Task | Summary |
| --- | --- | --- |
| `8efd707` / `50b5bbe` | 1 | Device-check Markets/Protect/Wallet captures + BUGS |
| `9ec83a6` | 2 | Wallet balance hang → error + Retry |
| `7e228b5` | 3 | Landing mockups from `EXPO_PUBLIC_MARKETING_SHOTS=1` captures |
| `09df16a` | 4 / 6 | Recording checklist + waitlist already-subscribed UI |
| `8a6df88` | 5 | Release notes SHA for current arm64 APK |

## Per-task results

### 1. adb install + screencaps

- SHA at install time matched prior notes; later rebuilds updated SHA (see release notes).
- Package sometimes installs `enabled=0` → `pm enable` required; Play Protect “Don’t send” can block `pm install`.
- Captures: `docs/landing-review/device-check-2026-10-16/{markets,protect,wallet}.png`
- Bugs: closed Des Moines window; Wallet balance hang (fixed); landing “Live” vs app lifecycle labels.

### 2. Device fix + rebuild

- Wallet: failed balance reads no longer sit on “Reading balances…” forever.
- `npm run test:mobile`: 113 pass. Release APK arm64-only (~46 MB) for Seeker.
- Current APK SHA-256: `a10b0ed4d71a81cf28c5b038ecb5a89ab59203e4f33654b3716fccb74afcde54`

### 3. Marketing mockups

- Built with `EXPO_PUBLIC_MARKETING_SHOTS=1`, captured, cropped 100px, wrote `client/public/mockups/landing/*`.
- Protect is **closed-window honest** (no fabricated premium). Wallet shot is connect CTA after reinstall (session cleared).
- Normal APK (flag off) rebuilt and reinstalled.

### 4. Recording checklist

- `docs/submission/recording-checklist.md` — scrcpy window title `Seeker`, DND, SKYT wallet, 2:30 timing.

### 5. Draft GitHub release

- Tag: `encode-seeker-revamp-8a6df88`
- **Draft** (unpublished): https://github.com/msourial/SkyHedge-Sol/releases/tag/untagged-71d2d81a4b1d38b12955
- Asset: `app-release.apk` (digest matches SHA above).

### 6. Waitlist polish

- Success + **Already on the list** (`already_subscribed`) verified on https://skyhedge.app (`POST /api/waitlist`).
- Mobile form layout tweaks in CSS. Production already serving the API status; mockup static assets need the deploy from this push.

### 7. Encode / push

- Encode project exists; confirm **solo** team in dashboard if prompted.
- `git push origin seeker-revamp` after this status commit (user-approved).

## Needs your approval / action

1. **Open/seed a new Des Moines Devnet window** (on-chain) so Protect can show a real priced quote and the demo purchase path works.
2. On Seeker: **Connect wallet** in the app, then we can recapture Wallet (and Protect quote) marketing frames if you want.
3. Confirm solo team in Encode UI.
4. Optional: delete test waitlist row `already-check-nonexistent-xyz@example.com` (ask first — not deleted).
5. Publish the GitHub release when ready; fill `<<DEMO_VIDEO_URL>>` after recording.

## Blocked / not done

- Priced Protect marketing frame (sales closed).
- Connected Wallet marketing frame (fresh install cleared session; MWA needs on-device approve).
- Map WIP still uncommitted (intentional).
- Anchor Devnet program upgrade not run.
- x402 not integrated.
