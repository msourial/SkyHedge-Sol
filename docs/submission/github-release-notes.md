# Draft GitHub release notes — Seek / Encode mid-submission

**Tag (suggested):** `encode-seeker-revamp-9ec83a6`  
**Branch:** `seeker-revamp`  
**Target:** Solana Seeker / Android Devnet demo (not Play Store)

## Assets

| File | Notes |
| --- | --- |
| `app-release.apk` | Built from `9ec83a6`+ with `EXPO_PUBLIC_API_BASE_URL=https://skyhedge.app` (arm64-v8a) |
| Local path | `mobile/android/app/build/outputs/apk/release/app-release.apk` |

**SHA-256:** `2603032b618005b529bf62dcf16d924e7217a7941ca2e0473d52464e173546ee`  
**Size:** 48065126 bytes

> Recompute SHA after any rebuild: `shasum -a 256 mobile/android/app/build/outputs/apk/release/app-release.apk`

## What's included

- Storm Glass Markets / Protect / Wallet UI on Seeker
- Wallet balance read: error + **Retry** (no infinite “Reading balances…”)
- Mobile Wallet Adapter + Phantom (Devnet / Testnet Mode)
- NOAA-backed Des Moines rainfall pilot quotes and tickets
- Waitlist landing at https://skyhedge.app (Neon-backed; `already_subscribed` UX)
- Encode submission pack under `docs/submission/`

## Devnet

- Program: `5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx`
- SKYT mint: `3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g` (no real value)
- Permissionless `settle_market` / `mark_data_unavailable` are in source; on-chain upgrade may still be pending
- **Demo note:** Des Moines sales window is currently closed — Protect CTA disabled until a new market is opened on-chain

## Install

```bash
adb install -r app-release.apk
```

Verify SHA-256 before sideload. Expect Play Protect prompts on sideload builds.

## Honesty

Devnet only. No real money. No fabricated traction. Demo script: `docs/demo-script.md`.
