# pm-AMM web migration

Work is local on `pm-amm-web`. No deployment or push is authorized. Native code and server routes remain unchanged.

## Status

M1 shared backend is complete and reviewed. M2 web routes/UI is complete and reviewed. M3 burner onboarding is complete and reviewed. M4 audit/final verification remains pending.

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
