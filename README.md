# SkyHedge

Devnet Solana software for **fixed-payout cumulative-rainfall protection markets**. Buyers pay a premium for a fixed payout if a station's cumulative rainfall crosses a threshold; liquidity providers earn those premiums. Settlement is driven by a **dual-source oracle consensus**: NOAA is final, WeatherXM verifies, and any failure resolves `DATA_UNAVAILABLE` — the system never synthesizes weather values.

`Weather risk → protection contract → Solana → deterministic NOAA settlement → payout`

## V1 boundaries

- Markets: New York, Miami, and Chicago cumulative rainfall.
- Collateral: six-decimal `SKYT` Devnet SPL test token.
- Capacity per market: 10,000 SKYT liquidity, 8,000 SKYT exposure, 500 SKYT per wallet.
- Pricing: ten analogous NOAA windows plus a 30%-weighted NOAA forecast signal; expected payout, 15% risk loading, and a 1% protocol fee.
- Settlement: NOAA final + WeatherXM verification within `max(5mm, 15% of NOAA)`; source hash committed on chain. If final NOAA data is unavailable after a 7-day grace window, the market enters `DATA_UNAVAILABLE` and buyers can reclaim premiums.
- AI advisory is advisory-only: it returns structured parameters and requires explicit user approval before an unsigned transaction can be prepared.

SkyHedge is not an options exchange, futures market, staking product, multi-chain app, or automated trading system.

## Architecture

```
client/            React + Vite SPA (wallet-adapter, sign & send of unsigned txs)
server/            Express API + services
  services/noaa.ts           NOAA CDO rainfall provider
  services/weatherxm.ts      WeatherXM Pro dual-source verifier
  services/consensus.ts      deterministic agree/disagree rule
  services/quote-engine.ts   pricing (analogous windows + forecast)
  services/solana-indexer.ts finalized-state indexer (30s sweep)
  services/unsigned-tx.ts    base64 VersionedTransaction builder (6 actions)
  services/settlement.ts     SettlementRunner (60s sweep, deadline + consensus)
shared/            Neon Postgres schema, IDL, methodology-v1.json
anchor/            Anchor program (skyhedge_protection) + 9 integration tests
scripts/           deploy/seed/status tooling
design-system/     OLED dark theme spec (MASTER.md + page specs)
```

Trust model: the server builds unsigned `VersionedTransaction`s and the wallet signs them offline; nothing is simulated. Positions shown in the portfolio reflect only finalized Solana state captured by the indexer.

## Prerequisites

- Node 22+, npm
- solana-cli 2.x, anchor-cli 0.30, Rust `nightly-2024-08-01`
- A Neon Postgres instance (or local pg) for `DATABASE_URL`
- Phantom or Solflare wallet set to Devnet

## Setup

```sh
npm install
cp .env.example .env   # fill in the values below
npm run db:push        # apply shared/schema.ts to Neon
```

Required env:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string |
| `NOAA_TOKEN` | NOAA Climate Data Online token (historical observations + forecast) |
| `WXM_API_KEY` | WeatherXM Pro API key (settlement verification) |
| `SOLANA_RPC_URL` | Default `https://api.devnet.solana.com` |
| `SKYHEDGE_PROGRAM_ID` | Default `7thTyPBaVCEBL2z28ojTxfmrbNMydXV3EAgbYgrz7GKr` |
| `SETTLEMENT_AUTHORITY_KEYPAIR` | Path to the settlement authority keypair (`anchor/keys/settlement-authority.json`) |
| `ANTHROPIC_API_KEY` | Optional — AI advisory enrichment |

If any weather provider is unreachable or a key is missing, the API returns `DATA_UNAVAILABLE` (HTTP 503). It never creates fallback weather observations.

## Run

```sh
npm run dev        # API + Vite SPA on :5000
npm run build      # production build (vite + esbuild)
npm run check      # tsc --noEmit
npm run test:server
```

## Localnet (end-to-end, no faucet needed)

```sh
npm run solana:build       # RUSTUP_TOOLCHAIN=nightly-2024-08-01 anchor build
npm run solana:test-local  # 9/9 integration tests (skip build)
npm run skyt:demo          # ONE COMMAND: boots validator, deploys, mints SKYT,
                           # initializes protocol, seeds+funds+opens 3 city markets,
                           # opens a 500 SKYT protection, runs the indexer, prints
                           # the DB portfolio. Idempotent — safe to re-run.
npm run skyt:status        # inspect on-chain protocol/markets
```

The demo leaves its localnet rows in Neon (markets/protections are not network-scoped). To keep the DB devnet-only before a real deploy: `TRUNCATE chain_events, markets, liquidity_positions, protection_positions, settlement_observations, indexed_slots;`

## Devnet deploy

```sh
npm run skyt:airdrop -- <wallet> 2 12 4   # retry loop until balance >= 4 SOL
npm run skyt:deploy                     # build + transfer + deploy program
npm run skyt:init                        # initialize protocol (admin wallet)
npm run skyt:seed                        # create city markets
```

The program ID is `7thTyPBaVCEBL2z28ojTxfmrbNMydXV3EAgbYgrz7GKr`; its deployment keypair (`anchor/target/deploy/skyhedge_protection-keypair.json`) and the settlement authority keypair are gitignored. The settlement authority pubkey is committed as an admin config choice; keep the keypair itself secret.

## API surface

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Program ID, network, settlement source |
| `GET /api/markets` | Indexed markets (falls back to seed catalog while empty) |
| `GET /api/weather/:city` `?start&end` | NOAA evidence for a window |
| `GET /api/weather/:city/forecast` | NOAA forecast for a window |
| `POST /api/quotes` | Premium quote (city, window, threshold, operator, amount) |
| `POST /api/advisory` | Structured advisory (city, risk, threshold, amount) |
| `GET /api/portfolio/:wallet` | Indexer-backed positions (never simulated) |
| `POST /api/transactions/unsigned` | Build a base64 VersionedTransaction (`approved: true` required) |
| `GET /api/settlement/evidence` | Settlement evidence ledger |
| `GET /api/markets/:id/evidence` | Evidence for one market |
| `POST /api/indexer/reconcile` | Trigger an indexer sweep |
| `POST /api/settlement/run` | Trigger a settlement scan |

Unsigned actions: `fund_pool`, `withdraw_liquidity`, `open_position`, `claim_payout`, `claim_premium_refund`, `redeem_closed_liquidity`. All amounts are in SKYT base units (6 decimals).

## Consensus rule (locked)

`shared/methodology-v1.json` pins the settlement rule. NOAA is final; WXM verifies; agree iff `|NOAA − WXM| ≤ max(5mm, 15% of NOAA)`; disagreement or any source failure → `DATA_UNAVAILABLE` after the on-chain deadline; never synthesize a value.

## Security posture

- All on-chain authority transitions use propose/accept rotation; market creation is admin-gated (`has_one = admin`); settlement observations require the settlement authority signature.
- Server builds transactions; wallets sign offline; the UI shows description + program ID before signing.
- Weather/quotes endpoints are rate-limited (30 req / 60s / IP) to protect provider quotas.
- No secrets in version control: `.env` and keypairs are gitignored.

## Known limits

- Devnet faucet airdrops are often rate-limited (429); retry later or use faucet.solana.com.
- Settlement to consensus requires `NOAA_TOKEN` + `WXM_API_KEY`; without them, markets stay pending and honest `DATA_UNAVAILABLE` paths apply.
- `seed-markets.ts` uses a fixed 2,000 bps quote probability per city; real quote-engine seeding needs `NOAA_TOKEN`.
