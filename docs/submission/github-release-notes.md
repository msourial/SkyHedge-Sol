# Draft GitHub release notes — Seek / Encode mid-submission

**Tag (suggested):** `encode-seeker-revamp-<shortsha>`  
**Branch:** `seeker-revamp`  
**Target:** Solana Seeker / Android Devnet demo (not Play Store)

## Assets

| File | Notes |
| --- | --- |
| `app-release.apk` | Built from this branch with `EXPO_PUBLIC_API_BASE_URL=https://skyhedge.app` |
| Local path | `mobile/android/app/build/outputs/apk/release/app-release.apk` |

**SHA-256:** `6becdfc300f917923e1e2f50d95839d384ddc62514249aba72cbe691e4ad954d`  
**Size:** 128 498 538 bytes (~123 MB)

> Recompute SHA after any rebuild: `shasum -a 256 mobile/android/app/build/outputs/apk/release/app-release.apk`

## What's included

- Storm Glass Markets / Protect / Wallet UI on Seeker
- Mobile Wallet Adapter + Phantom (Devnet / Testnet Mode)
- NOAA-backed Des Moines rainfall pilot quotes and tickets
- Waitlist landing at https://skyhedge.app (Neon-backed)
- Encode submission pack under `docs/submission/`

## Devnet

- Program: `5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx`
- SKYT mint: `3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g` (no real value)
- Permissionless `settle_market` / `mark_data_unavailable` are in source; on-chain upgrade may still be pending

## Install (you run)

```bash
adb install -r app-release.apk
```

Not installed by the agent. Verify SHA-256 before sideload. Expect Play Protect prompts on sideload builds.

## Honesty

Devnet only. No real money. No fabricated traction. Demo script: `docs/demo-script.md`.
