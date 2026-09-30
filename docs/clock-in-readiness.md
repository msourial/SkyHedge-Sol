# Clock In hackathon readiness

Event requirements were reviewed on September 30, 2026 at [solanamobile.radiant.nexus](https://solanamobile.radiant.nexus/).

## Fit

- Category: **Mobile**. The judging brief prioritizes usability, performance, and a phone-native experience.
- Existing web apps may compete when they add substantial mobile-specific development. A thin web wrapper or lightly optimized PWA is explicitly discouraged.
- SkyHedge is a pre-existing web and Solana project. The Android client in `mobile/` is a separate React Native app with device-native navigation and Solana Mobile Wallet Adapter; it reads real SkyHedge NOAA/API and finalized portfolio data.
- Eligibility also requires the project to have started within three months of launch, or significant new mobile development for an existing project. Confirm the project timeline in the submission.

## Required submission materials

| Requirement | State | Next step |
| --- | --- | --- |
| Functional Android APK | Refreshed local arm64 release APK built and launched on the Pixel 7 emulator; native navigation/screens render | Install and verify on a physical Android device before demo day |
| Cloneable GitHub repository | Existing repository is public | Push the mobile branch after review and keep build instructions current |
| Demo video, maximum 3 minutes | Not recorded | Record on a physical device: NOAA screen, research-only market labels, MWA wallet approval, and honest unavailable/empty states |
| Pitch deck or brief presentation | Five-slide deck and 2:30 demo outline drafted in [`clock-in-submission-draft.md`](clock-in-submission-draft.md); deck source file is in `docs/assets/` | Review the claims against the live deployment before using the deck URL |

## Important dates

- Submission deadline: **October 9, 2026, 2:59 a.m. EDT**
- Judging: October 10–November 9, 2026
- Winners announced: November 10, 2026
- Only one submission per contestant, either solo or on a team.

## Product guardrails for the demo

- Des Moines is a stale Draft Devnet market and must not be shown as purchasable.
- Do not create sample NOAA observations, quotes, wallet balances, or positions.
- Quote or transaction actions remain behind the existing final-evidence, exact-window, collateral, and explicit-approval checks.
- The final settlement source remains NOAA; WeatherXM is supplemental and not settlement-eligible.

## Current blockers

- The Android JS export succeeds. Metro emits non-fatal package-export fallback warnings from Solana wallet dependencies; verify MWA on a real wallet-enabled Android device.
- The Pixel 7 emulator launch verifies the native screens only. No MWA-compatible wallet app was available there, so wallet discovery, connection, and transaction signing are not yet device-verified.
- The arm64 release APK is a locally built install artifact, not a Play Store release. Its local debug signing is suitable for testing, not a production distribution channel.
- EAS CLI is installed, but no Expo account is signed in. A cloud build requires an Expo login and uploads app source to Expo; the project has not been uploaded or built.
- The Android app is configured to call the production HTTPS SkyHedge API. The mobile-specific Vercel routes are on this branch; until a preview deployment is verified, the production city APIs still return an incompatible response and NOAA-backed mobile data will be unavailable.
- The hackathon account is already registered as solo with verified email. A project submission draft was saved, but final submission requires GitHub connection, eligibility answers, a demo URL, and an APK URL.
- The hackathon portal says GitHub connection grants Align read-only access to repositories the builder selects. It has not been authorized.
