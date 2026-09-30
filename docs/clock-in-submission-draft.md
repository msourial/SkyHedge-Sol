# Clock In submission draft

## Project

**SkyHedge — rainfall protection on Solana Mobile**

**Category:** Mobile  
**Entry type:** Solo project

## Short description

SkyHedge is an Android-first rainfall-index protection experience. The native app brings NOAA rainfall observations, researched market locations, and Solana Devnet wallet access into one phone-native flow. Missing observations stay unavailable, unvalidated markets stay research-only, and the wallet view shows only indexed positions. The current mobile build does not offer purchases or create sample positions.

## Why mobile

Farmers and agricultural operators need a clear view of rainfall evidence and protection status while away from a desktop. SkyHedge's Android client uses native navigation and Solana Mobile Wallet Adapter. It connects to an existing SkyHedge API for NOAA index data, the market research catalog, release status, and portfolio reads. It is a React Native client, not a WebView of the existing site.

## What is ready

- Native Android screens for rainfall, market research, and wallet/portfolio.
- NOAA-backed current index data and completed-week history, with explicit unavailable states.
- Market catalog labels that preserve research status until evidence is validated.
- Solana Mobile Wallet Adapter authorization on Devnet and a read-only portfolio view.
- Checkout remains gated by the existing release and evidence checks.

## Demo outline (target: 2:30)

1. **0:00–0:20 — Open the app.** Show the SkyHedge Android home screen and phone-native navigation.
2. **0:20–0:55 — Inspect rainfall.** Select a location, explain the NOAA station and observation window, then show the measured rainfall or the honest unavailable state returned by the live API.
3. **0:55–1:20 — Review markets.** Open Markets and explain why locations without validated settlement evidence remain research-only.
4. **1:20–1:55 — Connect a wallet.** Use an MWA-compatible Android wallet on Devnet, approve public-address access, and show the finalized/indexed portfolio response, including an empty portfolio if there are no positions.
5. **1:55–2:20 — Explain the safety gate.** Show that the stale Des Moines Draft market is unavailable for purchase while its NOAA evidence is unvalidated.
6. **2:20–2:30 — Close.** Summarize the mobile workflow and point to the repository and API-backed implementation.

Record this on a physical Android device after the APK and wallet flow have been verified. Use live service data; do not stage observations or positions.

## Repository and build

- Repository: https://github.com/msourial/SkyHedge-Sol
- Android client and build notes: [`mobile/README.md`](../mobile/README.md)
- Build profile: `mobile/eas.json`, profile `hackathon-apk`
- Device builds need an MWA-compatible wallet and a reachable HTTPS SkyHedge API deployment.

## Before submitting

- Build and install the APK; verify it on a physical Android phone.
- Confirm the project's start date or document the substantial new Android work for eligibility.
- Record the demo video, no longer than three minutes.
- Turn this brief into the required pitch deck or presentation.
- Confirm the current API deployment and Devnet release status; keep claims and screenshots consistent with live evidence.
- Submit by **October 9, 2026 at 2:59 a.m. EDT** and ensure this is the contestant's only entry.
