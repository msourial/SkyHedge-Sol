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
| Functional Android APK | The public production-API APK was built from `382592a`. A keyless-map candidate from `ff23d50` is installed on the Seeker but has not been visually verified; its SHA-256 is in [the submission brief](clock-in-submission-draft.md). | Verify the candidate's map on the Seeker before replacing the public download; wallet signing remains unverified |
| Cloneable GitHub repository | Public `main` is at `4e83eca`; the map candidate is on `codex/clock-in-mobile`, not in the public APK | Publish only the exact reviewed and device-tested build, then record its source commit |
| Demo video, maximum 3 minutes | A video URL is entered in Align, but its transcript is unusable and the coach reports `DEMO NONE` | Record a clear narrated Seeker flow and confirm Align can read it; show the honest blocker if activation fails |
| Pitch deck or brief presentation | [Five-slide deck](clock-in-pitch.pptx), [PDF](clock-in-pitch.pdf), and [three-minute outline](clock-in-submission-draft.md) prepared; Align confirmed it can read the public PDF | Update pilot-status slide after wallet approvals, then review the final claims |

## Important dates

- The live registered Align draft shows **October 12, 2026 at 7:59 a.m. EDT** (11:59 a.m. UTC); [Solana Mobile's announcement](https://solanamobile.com/blog/clock-in-the-solana-mobile-hackathon) still says October 8. Submit before the live account deadline rather than assuming either source has been reconciled.
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
- The registered solo entry remains a draft. Align has repository, APK, deck, and video URLs, but reports `DEMO NONE` with an unusable transcript. The final agreement and submission remain user actions.
- Align has read-only GitHub access to `msourial/SkyHedge-Sol` and ran its advisory audit. Its findings need triage; an audit score is not proof of security.
- The public release APK link resolves to an asset whose GitHub SHA-256 matches the local public build. The `ff23d50` keyless-map candidate built and installed on the Seeker, but the phone is currently unavailable for visual verification; it has not replaced the public asset.
- On October 9, finalized Devnet still reports Des Moines market 0 as Draft with a zero-SKYT vault and `nextMarketId` 1. Its address has only the original creation signature; the reported cancellation is not recorded on-chain. The deployed binary contains the cancellation instruction, so the admin transaction signature is needed to trace the failed handoff.
- Current checks pass: 148 server tests, 27 mobile tests, and root TypeScript. Earlier Android build and browser results do not replace device verification or physical wallet signing. The dependency audit still reports unresolved critical/high findings.
