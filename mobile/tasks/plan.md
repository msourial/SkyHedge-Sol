# SkyHedge Mobile Hackathon Readiness Plan

## Overview

Finish the already-started native Android client as a reviewable, installable SkyHedge mobile pilot. Keep its real NOAA/API data and Devnet wallet behavior, build locally where possible, and prove the app launches on an Android runtime without uploading source to a cloud build provider.

## Architecture decisions

- Continue with the existing Expo / React Native Android application; it uses native Android screens and Solana Mobile Wallet Adapter rather than a WebView wrapper.
- Keep SkyHedge API reads and Devnet identity explicit. Do not add sample observations, market readiness, test balances, or claims.
- Prefer a local Android build. Do not submit source to Expo EAS or the hackathon portal without explicit approval.
- Treat a real Android phone and a real MWA wallet as required final validation; emulator success alone is not represented as device validation.

## Task list

### Phase 1: Build readiness
- [ ] Task 1: Verify local Android toolchain and native app prerequisites.
- [ ] Task 2: Build an installable debug APK locally and record its exact path/hash.

### Checkpoint: Local build
- [ ] TypeScript and Android bundle checks pass.
- [ ] APK exists and installs/launches on an available emulator or device.

### Phase 2: Mobile behavior proof
- [ ] Task 3: Verify API failure/empty/research-only states and Android navigation on device or emulator.
- [ ] Task 4: Verify MWA discovery/connection behavior; never claim a successful wallet test without a compatible wallet app.

### Checkpoint: Mobile pilot
- [ ] App is usable at phone-sized layouts and displays real service state or honest unavailability.
- [ ] No checkout, oracle, or payout path is implied when the market is not finalized and evidence-gated.

### Phase 3: Submission readiness
- [ ] Task 5: Update readiness and submission notes with verified artifacts, remaining gates, and reproducible build steps.
- [ ] Task 6: Review changes and publish a dedicated mobile branch only after verification.

### Checkpoint: Ready for handoff
- [ ] Cloneable source and build instructions are available.
- [ ] APK, physical-device demo, video, and hackathon submission status are reported distinctly.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| No usable JDK despite Android SDK being installed | Local APK cannot build | Inspect Android Studio/runtime JDK locations; do not silently upload code to EAS |
| No physical Android phone or MWA wallet connected | Device/wallet behavior remains unverified | Use emulator for UI only and clearly list physical-device verification as outstanding |
| API service or forecast evidence unavailable | Data/action states may be empty | Preserve truthful unavailable/researching states; no mock data |
| Hackathon submission requires personal/eligibility answers or accepts terms | External legal/personal-data action | Prepare artifacts only; leave final submission and unprovided eligibility answers for the user |

## Official references

- Expo local Android compilation: https://docs.expo.dev/guides/local-app-development/
- Expo APK configuration: https://docs.expo.dev/build-reference/apk/
- Solana Mobile Wallet Adapter: https://github.com/solana-mobile/mobile-wallet-adapter
- Clock In event: https://solanamobile.radiant.nexus/
