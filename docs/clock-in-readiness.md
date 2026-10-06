# Clock In hackathon readiness

Event requirements were reviewed at [solanamobile.radiant.nexus](https://solanamobile.radiant.nexus/). Recheck the registered account before final submission.

## Fit

- Category: **Mobile**. The judging brief prioritizes usability, performance, and a phone-native experience.
- Existing web apps may compete when they add substantial mobile-specific development. A thin web wrapper or lightly optimized PWA is explicitly discouraged.
- SkyHedge is a pre-existing web and Solana project. The Android client in `mobile/` is a separate React Native app with device-native navigation and Solana Mobile Wallet Adapter; it reads real SkyHedge NOAA/API and finalized wallet/market status. Portfolio indexing is not available yet.
- Eligibility also requires the project to have started within three months of launch, or significant new mobile development for an existing project. Confirm the project timeline in the submission.

## Required submission materials

| Requirement | State | Next step |
| --- | --- | --- |
| Functional Android APK | Production-API release APK installed on a physical Seeker; Explore and Protect read live API/Devnet state. SHA-256 in [`mobile/README.md`](../mobile/README.md) | Complete wallet handoff and transaction-signing test |
| Cloneable GitHub repository | Mobile work is pushed to `codex/clock-in-mobile` on the public repository | Keep build instructions current; merge only after normal review |
| Demo video, maximum 3 minutes | Not recorded | Record the real Seeker flow after admin activation and tester signing; show the honest blocker if activation fails |
| Pitch deck or brief presentation | [Five-slide deck](clock-in-pitch.pptx), [PDF](clock-in-pitch.pdf), and [three-minute outline](clock-in-submission-draft.md) prepared | Update pilot-status slide after wallet approvals, then review the final claims |

## Important dates

- Internal submission cutoff: **October 8, 2026**. The official announcement and organizer calendar differ; use the earlier date and confirm the registered account's countdown.
- Winners announced in early November, according to the [Solana Mobile announcement](https://solanamobile.com/blog/clock-in-the-solana-mobile-hackathon).
- Only one submission per contestant, either solo or on a team.

## Product guardrails for the demo

- Des Moines is an expired Draft Devnet market with an empty vault and must not be shown as purchasable until a new market is finalized as `OPEN` with real collateral.
- Do not create sample NOAA observations, quotes, wallet balances, or positions.
- Quote or transaction actions remain behind the existing final-evidence, exact-window, collateral, and explicit-approval checks.
- The final settlement source remains NOAA; WeatherXM is supplemental and not settlement-eligible.

## Current blockers

- The Android JS export succeeds. Metro emits non-fatal package-export fallback warnings from Solana wallet dependencies; verify MWA on a real wallet-enabled Android device.
- The Seeker launch verifies the native screens and production-API reads. Solflare handoff reached its passcode screen in an emulator, but physical-wallet authorization and signing remain unverified.
- The arm64 release APK is a locally built install artifact, not a Play Store release. Its local debug signing is suitable for testing, not a production distribution channel.
- EAS CLI is installed, but no Expo account is signed in. A cloud build requires an Expo login and uploads app source to Expo; the project has not been uploaded or built.
- The mobile read API is deployed on the public production domain. Catalog, unindexed-portfolio, health identity, and JSON response checks passed. A protected preview was built successfully, but its URLs require Vercel access; no preview URL is used by testers.
- The physical Seeker displayed the Des Moines NOAA station, real Draft/empty-vault state, and unavailable purchase reason from the production API on October 6.
- The hackathon account is already registered as solo with verified email. A project submission draft was saved, but final submission requires GitHub connection, eligibility answers, a demo URL, and an APK URL.
- The hackathon portal says GitHub connection grants Align read-only access to repositories the builder selects. It has not been authorized.
