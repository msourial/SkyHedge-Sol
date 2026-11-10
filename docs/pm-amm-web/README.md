# pm-AMM web migration

Work is local on `pm-amm-web`. No deployment or push is authorized. Native code and server routes remain unchanged.

## Status

M1 shared backend is complete and reviewed. M2 web routes/UI, M3 wallets and M4 audit/final browser verification remain pending. The current site still serves its previous web app until M2.

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
