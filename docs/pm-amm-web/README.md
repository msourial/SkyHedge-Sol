# pm-AMM web migration

Branch `pm-amm-web`, draft PR #31 into `web-app-and-landing`. Vercel preview deployments only; never production. Native code and server routes remain unchanged.

## Status

M1 shared backend is complete and reviewed. M2 web routes/UI is complete and reviewed. M3 burner onboarding is complete and reviewed. M4 audit and final verification are complete, with the remaining advisories documented below.

## Architecture and operation

`shared/pm-amm/` contains the strike schema, deterministic on-chain name, strict NOAA daily evaluator, official quote helpers, raw-unit validation and position valuation. `markets.devnet.json` is the public strike catalog; `evidence/` contains settlement records. Root SDK is pinned to 0.2.0. Operator scripts load external mode-600 wallets from `~/.config/skyhedge-pmamm/`; keys never enter browser assets or server functions.

Run `npm ci`, `npm run check` and `npm run test:pmamm`. Scripts run from repository root with `node --import tsx scripts/pm-amm/<script>.ts`. `create.ts` defaults to a dry run; `--demo` selects historical mechanics. `resolve.ts --market <address>` fetches and evaluates NOAA without sending; `--send` resolves. `creator-claim.ts --market <address> --send` redeems LP residuals then winning tokens. `collect.ts` redeems the demo trader's winning tokens. `verify.ts` checks finalized receipts and catalog identities. `trade.ts` is a shared-code quote/buy check using external creator or `--no` trader keys.

Every send is preceded by a persisted attempt marker in `run.devnet.json`. Do not delete markers to retry: inspect chain history and reconcile first. There is no automatic retry after an ambiguous send. Run only one operator process at a time. If a send succeeds but the local catalog/evidence write fails, recover its signature/PDA from the log or chain before proceeding.

## Market decisions and trust

Two upcoming markets use Central Park and O'Hare, trading until December 7, 2026 at 00:00 UTC for December 8–9 station observation days. NOAA station identifiers and names were checked against the [GHCN station list](https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt), retrieved November 10, 2026. Station records denote local observation days, not a guarantee of midnight-to-midnight measurements. Normal trading closes before local midnight at the start of observations.

The chosen seed is 400 mUSDC per upcoming market, within measured creator funds. See [computed liquidity table](liquidity.md). A 10 mUSDC typical trade is an assumption for sizing. The 50 mUSDC historical demo trades already-known weather solely to test mechanics.

A single creator key resolves using NOAA. NOAA may revise data; there is no dispute window or on-chain verification of weather. Complete unflagged daily records are required, with precipitation summed in integer tenths of mm and an inclusive threshold. See [missing-data behavior](no-data-plan.md): these binary markets do not offer a void/refund path. Funds may remain waiting indefinitely. Prices move with trades and time; seed prices are not weather forecasts. Position mark values are estimates, not guaranteed sale proceeds.

All transaction signatures and devnet Explorer URLs are recorded in [run log](run.devnet.json); the catalog records each creation signature. Finalized token receipts are added by `verify.ts`.

Measured demo: October 1–2 NOAA total 0.0 mm against ≥ 1.0 mm, resolved NO. Trader collected 10.089787 mUSDC. Creator residual redemption was followed by 49.710212 mUSDC winning-token redemption. Finalized receipts assert that each winning-token burn equals the mUSDC increase. A second creator script run sends nothing.

## Web routing and use

`npm run build:site` builds only the Vite React client into `dist`; `node --import tsx scripts/web-preview.ts` serves it locally on port 5002. `/app` and all subroutes use that client, including refresh/deep links. `/preview` redirects to `/app`. Landing `/` stays in Vite. `npm run build` builds the same React app into `dist/public` plus the Express server; development and production Express fallbacks also use the React index. Expo exports are excluded from both builds and Vercel installation. Android remains on its existing code and server APIs.

Connect Phantom on devnet, select a market, choose Yes or No and enter mUSDC. Review shows fee, estimated shares and minimum output. Before sending, the app re-fetches state; changed reserves or a quote below the reviewed minimum require another review. Signing broadcasts through a hardcoded devnet connection. Market and token balances poll every 15 seconds while the tab is visible and refresh after confirmed sends. Positions show associated token balances and estimated marks; settled winners can Collect. Settlement details link the exact NOAA query, daily values, total, threshold, outcome and devnet resolution/Collect receipts.

## Demo wallet

The official PREDICT `burner.ts` and `useBurnerWallet.ts` are preserved verbatim after source attribution headers under `client/src/lib/pm-burner/`. The app uses the kit's wallet, funding, export/reset and signing functions through `session.ts`. This guarded React wrapper replaces the upstream hook lifecycle so initial RPC/storage failures are handled and funding attempts persist before requests; the upstream hook remains available unchanged for comparison. Vite supplies Buffer. `bs58` is pinned at root.

A disposable browser wallet loads automatically and requests devnet funds when low. One attempt per wallet per hour is enforced locally as well as by the faucet; reloads cannot loop on refusals. RPC failure is reported, rather than treated as an unfunded wallet. Existing positive balances can still trade after a refused top-up. Use Export key explicitly to save access, and Hide key afterward. New wallet requires a separate loss warning and confirmation; do not use it to bypass limits. Browser storage is for devnet play money only. Phantom remains selectable; switching signers clears trade review and wallet-specific balances. Creator/resolver keys never enter this flow.

## Final validation and screenshots

The real devnet operator check used the existing disposable `no-trader.json` key outside the repo to quote and buy NO in the upcoming New York market via shared `quote()`/minimum logic and SDK signing. Finalized receipt: 5 mUSDC paid, 9.762056 NO shares received.

A separate real browser burner was automatically funded by the official faucet, bought YES for 5 mUSDC and received 9.837940 YES shares, above its reviewed 9.739559-share minimum. Its public wallet, funding and trade receipts are in [browser log](browser.devnet.json). `verify-browser.ts` checks finalized funding/trade status, input debit, output mint and minimum. These checks do not substitute for a real Phantom-extension test; Phantom approval paths are mocked in the browser suite.

Live screenshots (no RPC fixtures): [markets](shots/markets.png), [review](shots/review.png), [positions](shots/positions.png), [settled verification](shots/settled-verification.png), [phone](shots/markets-mobile.png). The settled demo's winning tokens have already been redeemed, so that wallet's current balance has no remaining payout; Collect is shown only for positive winning balances. Mocked tests exercise its enabled state and submission.

To capture again, build/serve the site, then run `node --import tsx scripts/pm-amm/screenshots.ts`. It reuses an external browser profile and defaults to screenshots only. `--trade` explicitly authorizes a new 5 mUSDC test purchase; do not rerun it to resolve an uncertain send. It never reads/exports the browser key. Run `verify-browser.ts` afterward to refresh receipts. Preserve the external profile to retain access to the browser's positions.

## Remaining work and owner decisions

- Operate the resolver after NOAA has published every December 8–9 observation day. Local day end is December 10 at 05:00 UTC for New York and 06:00 UTC for Chicago; publication can be later. Run dry evaluation, inspect evidence, then explicitly send. Keep creator keys backed up outside the site and server environments.
- Missing/flagged data waits indefinitely; no alternate station or binary refund path is implemented. The single creator key remains trusted, with no dispute window. Independent resolution and a program-supported unavailable-data outcome need future design before real funds.
- The browser offers buys and Collect. Shared math also quotes sells; a sell control, LP interface and browser market creation are outside this implementation.
- [Root audit](audit.md): full findings reduced from 61 to 45, high from 19 to 7; production findings from 44 to 29, high from 17 to 7. No critical findings. The seven remaining high paths come from unpatched bigint-buffer/toml dependencies. No finding is suppressed.
- The owner still handles push, preview deployment and judging verification. No push, PR, Vercel command or deployment was performed. Android/Seeker source, Anchor source and existing API routes remain unchanged.

Decisions implemented: two upcoming station markets; 400 mUSDC seed each; inclusive multi-day NOAA rainfall; trading closes before observations; historical demo clearly marked; no station substitution; devnet only.

## Transaction links

- create:USW00094728: [5sCkekaRALVG2xxnJvYQAi8fPWvTupjDbG55KVrHL3uqU35TS89Nyf7t8CyAK6rBdtzvGM3pCF2q7Kku89up4GoU](https://explorer.solana.com/tx/5sCkekaRALVG2xxnJvYQAi8fPWvTupjDbG55KVrHL3uqU35TS89Nyf7t8CyAK6rBdtzvGM3pCF2q7Kku89up4GoU?cluster=devnet)
- create:USW00094846: [GPH96c3iZqErYU3E8vUtNwA5so67NApjwMPJojtnPbst2USx552NJKezFaiAsFg4WFY7mQFTLmhuYbVpLBREhsB](https://explorer.solana.com/tx/GPH96c3iZqErYU3E8vUtNwA5so67NApjwMPJojtnPbst2USx552NJKezFaiAsFg4WFY7mQFTLmhuYbVpLBREhsB?cluster=devnet)
- create:demo: [5YBbP5pWP7eg8TP9fLyx3hNYNvgAe8duz2FtwKrgBL7TR5aiA9YVroU1jQqog2d8pv9HD1kWX4ZSzH1pXR4YbKnn](https://explorer.solana.com/tx/5YBbP5pWP7eg8TP9fLyx3hNYNvgAe8duz2FtwKrgBL7TR5aiA9YVroU1jQqog2d8pv9HD1kWX4ZSzH1pXR4YbKnn?cluster=devnet)
- buy:FQnafUsLzwYE9u8k681xM8AVwViBxJrBm1EkWVFWZFyp:usdcToYes: [5WMBRHq7GqrfB8NBFnunWFf8xFY2kzTFeGHaPTUq1raLwLyXWuzubSVx87VZH3Yb3KYkfHMRW1YTFvgCgm3jC5nt](https://explorer.solana.com/tx/5WMBRHq7GqrfB8NBFnunWFf8xFY2kzTFeGHaPTUq1raLwLyXWuzubSVx87VZH3Yb3KYkfHMRW1YTFvgCgm3jC5nt?cluster=devnet)
- buy:FQnafUsLzwYE9u8k681xM8AVwViBxJrBm1EkWVFWZFyp:usdcToNo: [29qvXyHjQ2BqESZhSzgsSH2VebzxQHVCWG9cnzqhR8nJJKyBKmr4j9xoKtCv99choLk8rZccgurGHGrCj242Nn29](https://explorer.solana.com/tx/29qvXyHjQ2BqESZhSzgsSH2VebzxQHVCWG9cnzqhR8nJJKyBKmr4j9xoKtCv99choLk8rZccgurGHGrCj242Nn29?cluster=devnet)
- resolve:FQnafUsLzwYE9u8k681xM8AVwViBxJrBm1EkWVFWZFyp: [2gnH6ABygsdrN2RiNyWvPEzFc2hsTPRjie5xvh5LuJdb7AkE3cLrmfp9CLDa811nP4TULYAD6T596HvMmEk5Qmyi](https://explorer.solana.com/tx/2gnH6ABygsdrN2RiNyWvPEzFc2hsTPRjie5xvh5LuJdb7AkE3cLrmfp9CLDa811nP4TULYAD6T596HvMmEk5Qmyi?cluster=devnet)
- collect:FQnafUsLzwYE9u8k681xM8AVwViBxJrBm1EkWVFWZFyp:DduTTfJeq6HZvua6bx5n2pMNcTjh7pr63V9uKDe37VC1: [4d427Pf7srddY6wqFkvgTsWecSBCBBQwumBuCxXezdwy4G5Qer6uHsZdQ8Dv2BU6Vwcse7PVbpmkFmWEMozD2vxG](https://explorer.solana.com/tx/4d427Pf7srddY6wqFkvgTsWecSBCBBQwumBuCxXezdwy4G5Qer6uHsZdQ8Dv2BU6Vwcse7PVbpmkFmWEMozD2vxG?cluster=devnet)
- residuals:FQnafUsLzwYE9u8k681xM8AVwViBxJrBm1EkWVFWZFyp: [4JqQUwKDmbf5VjrAh9mkPZe1TcWTMcDSoJiEFgt7F2dpAk5HKqos8W5SYA2CVR3E54UGvD8sPCgy6P2DJ7Q3a2Yp](https://explorer.solana.com/tx/4JqQUwKDmbf5VjrAh9mkPZe1TcWTMcDSoJiEFgt7F2dpAk5HKqos8W5SYA2CVR3E54UGvD8sPCgy6P2DJ7Q3a2Yp?cluster=devnet)
- creator-winnings:FQnafUsLzwYE9u8k681xM8AVwViBxJrBm1EkWVFWZFyp: [2ySSLRtWgPae3zbaRgYAg4BZs7Ei3RJMiS3tqyir8SXvDfprNqP4F4UKtnZbJydpPf6kc3AyJTRzNDQhxGEPve4S](https://explorer.solana.com/tx/2ySSLRtWgPae3zbaRgYAg4BZs7Ei3RJMiS3tqyir8SXvDfprNqP4F4UKtnZbJydpPf6kc3AyJTRzNDQhxGEPve4S?cluster=devnet)
- buy:CHHaCqtcqe8i6NUM7WZdB2pfxn5fqEUx2b4DTq1RL3hS:usdcToNo: [39aCT7d3Whssh2NMCUf2RCL7P2nM3KUv3xBoAqRoN1ow2rUPDUmujLPEnhh8cjU7RPQhPLyqL5SFqFP1pUvBmwaN](https://explorer.solana.com/tx/39aCT7d3Whssh2NMCUf2RCL7P2nM3KUv3xBoAqRoN1ow2rUPDUmujLPEnhh8cjU7RPQhPLyqL5SFqFP1pUvBmwaN?cluster=devnet)
- Browser faucet: [jwUDJ1NLEph9mWmWGa7bgQ5n3aQSQ8G8Str1gC2LJQ4tHNqFRH6psYWS2usckJh2d2EAxQRQMuGcopbXpZo1vJa](https://explorer.solana.com/tx/jwUDJ1NLEph9mWmWGa7bgQ5n3aQSQ8G8Str1gC2LJQ4tHNqFRH6psYWS2usckJh2d2EAxQRQMuGcopbXpZo1vJa?cluster=devnet)
- Browser buy Yes with 5 mUSDC: [transaction](https://explorer.solana.com/tx/26NGdjGNQf1DE2y3epC6GYBiZLVDy7neeLU2yKYA5DkuE4imuup9cpWp6YkMBGbsYXqYqYZDpA1EE2yUSZeXW2bg?cluster=devnet)

Final supported-runtime checks passed on Node v22.23.4: typecheck; line, server, Phantom, spike, shared pm-AMM and all 17 web tests; site build. Root server/site build checks are also recorded in REVIEW.md.
