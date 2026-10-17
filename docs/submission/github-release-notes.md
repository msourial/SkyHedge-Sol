# Draft GitHub release notes — Encode consumer polish

**Do not publish.** Create this as a draft. `gh` is not installed on this machine.

**Tag (suggested):** `encode-seeker-revamp-d9bd86a`
**Branch:** `seeker-revamp`
**App commit:** `d9bd86a3468234aab5314ee13ac5c68ace28a36a`
**Target:** Solana Seeker / Android Devnet demo (not Play Store)

## Assets

| File | Notes |
| --- | --- |
| `app-release.apk` | Built from `d9bd86a` with `EXPO_PUBLIC_API_BASE_URL=https://skyhedge.app` |
| Local path | `mobile/android/app/build/outputs/apk/release/app-release.apk` |

**SHA-256:** `17284a09681a24fb72f370c03caf2f28e5befb94b2528ff68b2ca69ce57ace10`
**Size:** 128499214 bytes

Not installed on a device.

## What's included

- Landing headline: Rain on your plans? Get paid.
- NOAA rainfall cities on the weekly and monthly ladder: New York, Chicago, Miami, Dallas, Los Angeles, Seattle, Boston, Austin, Des Moines. Toronto stays closed.
- Green chip only while weekly and monthly windows are selling. New York and Des Moines are open. Chicago and Miami still need Phantom signatures.
- Open web app links to `/app`.
- Devnet test SKYT only. No real-world value.

## Devnet

- Program: `5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx`
- SKYT mint: `3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g`
- Admin signer for the missing ladders: `DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y`

## Create the draft (after `gh` is installed and authed)

```bash
cd /Users/m/Documents/Codex/2026-08-12/i-would-stop-positioning-v1-as/work/SkyHedge-clock-in-redesign
gh release create encode-seeker-revamp-d9bd86a \
  mobile/android/app/build/outputs/apk/release/app-release.apk \
  --repo msourial/SkyHedge-Sol \
  --target seeker-revamp \
  --draft \
  --title "Encode consumer polish (draft)" \
  --notes-file docs/submission/github-release-notes.md
```

`--draft` keeps it unpublished. Do not add `--latest` or omit `--draft`.

## Install later, only after you confirm

```bash
adb install -r mobile/android/app/build/outputs/apk/release/app-release.apk
```

Verify the SHA-256 before sideload. Expect Play Protect prompts on sideload builds.
