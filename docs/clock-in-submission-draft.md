# CLOCK IN submission brief — verify before uploading

## Project

**SkyHedge — NOAA-backed rainfall protection on Solana Mobile**

**Category:** Mobile

**Entry:** Solo project (confirm in the registered Align account)

SkyHedge helps someone understand a specific rainfall risk, inspect its NOAA evidence, and—only when a real Devnet market is open—review a fixed-payout test contract and approve it in a Solana Mobile wallet. The Android client is native React Native, not a WebView. SKYT is a valueless Devnet test asset, not USD or USDC. The ordinary dollar amount is a non-binding preview, never a payment quote.

## Verified as of October 7, 2026

- The Devnet program is executable and its committed IDL, protocol account, settlement authority, and SKYT mint are readable at finalized commitment.
- The SKYT mint's finalized supply is 350,000 test tokens. No new mint is planned for this submission.
- A live NOAA station/quote package exists for Des Moines. Its historical sample validates station data availability; it is **not** future settlement rainfall.
- The only on-chain Des Moines market is an **expired Draft with an empty vault**. It must be canceled by the admin, then a fresh market created, funded with 2,000 SKYT, and opened before any purchase can be claimed as working.
- The production-API APK built from commit `382592a` is installed on the physical Seeker and published in the [CLOCK IN prerelease](https://github.com/msourial/SkyHedge-Sol/releases/tag/clock-in-2026-10-07). The installed package and release APK have the same SHA-256: `322cfb18428400c63e9173b8e39e5a0181255069ee53589f4bb370111e1e4987`. The Explore screen renders, but the other three screens and wallet approval are not yet physically verified.
- Wallet handoff reached Solflare in an emulator. Physical-device authorization, purchase signing, and finalized position are **not yet verified**.
- The Seeker displayed a Play Protect warning before this APK was installed. Identify the flagged app before using a wallet; do not assume the warning concerns SkyHedge or dismiss it without inspection.
- The settlement worker lacks production signer/cron configuration. Do not claim automated live settlement or a completed Devnet payout.
- Radiants Align has read the public `msourial/SkyHedge-Sol` repository for its advisory audit; the separate GitHub App authorization remains unconfirmed. The entry is **saved as a draft**, not submitted. Its APK, source, and deck links are present; the public demo video is still missing.

## Why this is mobile-native

A grower or event organizer can check a place and its evidence while away from a desk. The app separates a plain-language preview from Devnet testing, uses Solana Mobile Wallet Adapter for explicit wallet approval, and shows finalized on-chain proof only after confirmation. NOAA is the sole settlement source; WeatherXM is not used for settlement. Research-only locations and wind/snow hazards cannot silently inherit rainfall readiness.

## Three-minute demonstration — record only what is verified

1. **0:00–0:25 — Real risk.** Name the Des Moines rainfall scenario and show the selected exact location on the physical Android phone.
2. **0:25–0:55 — Evidence.** Show the NOAA station, exact immutable observation dates, and the difference between historical/forecast pricing inputs and future final rainfall.
3. **0:55–1:25 — Decision.** Show the fixed payout, actual SKYT test premium as maximum test-asset cost, 500-SKYT wallet cap, and explicit no-real-value notice. Never call a SKYT premium dollars.
4. **1:25–2:20 — Wallet and proof, only if activated.** On a non-admin tester wallet, approve the transaction yourself, wait for finalized confirmation, then show the real position and Explorer signature. If the market is still Draft or evidence expires, show the exact blocker instead—do not stage a purchase.
5. **2:20–2:50 — Trust boundary.** Explain that the authorized SkyHedge settlement signer attests final NOAA rainfall, while the program enforces the outcome and claim transfer. Local-validator payout/refund tests are not a live Devnet payout.
6. **2:50–3:00 — Next step.** Say that regulated USD/USDC collateral and broader locations are future work, not current checkout.

Do not show private wallet recovery material, API keys, or account notifications in the recording. Keep the exported video at or below three minutes.

## Entry package and release gate

- Source: https://github.com/msourial/SkyHedge-Sol at the final `main` commit — record its hash when submitting. The installed APK was built from `382592a`; later source commits have not been rebuilt into that APK.
- Android: [production-API APK prerelease](https://github.com/msourial/SkyHedge-Sol/releases/tag/clock-in-2026-10-07), installed on the Seeker and checksum-matched. This is debug-signed and remains a Devnet demonstration build; verify the final APK and all four screens before submission.
- Video: real phone capture following the outline above, with only verified claims.
- Presentation: [public, downloadable Google Drive PDF](https://drive.google.com/file/d/17ngEonwhYLPA4-_IlPJ8YQdMUHarsVLT/view) explaining problem, evidence-to-wallet journey, on-chain trust boundary, limitations, and USD/USDC path. This is the deck link saved in Align; its AI coach has not yet confirmed it can read the deck.
- In the registered Radiants Align account, verify the account's actual cutoff and review the submission agreement yourself. Use **October 8** as the internal cutoff; do not rely on the later calendar date.

Remaining gates before saying “end-to-end purchase works”: admin cancellation and three seed signatures, finalized `OPEN` market and 2,000-SKYT vault, small wallet-approved transfer to a non-admin tester, physical-phone MWA approval, and a finalized position with Explorer proof. The saved Align draft still needs a public video and the user's final submission review.
