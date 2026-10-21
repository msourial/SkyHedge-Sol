# SkyHedge: weather protection you buy from your phone

> **Parametric weather protection on Solana.** Pick a place and a weather risk, see a quote priced from NOAA data, approve it in your wallet, and get paid on-chain automatically when the weather data shows the trigger was hit. No claims adjuster, no paperwork.
>
> **Encode Club Solana Hackathon 2026** entry · native React Native Android app (built for the Solana Seeker) · Solana Devnet · Mobile Wallet Adapter.

| | |
|---|---|
| Live site | **https://skyhedge.app** (waitlist) · **https://skyhedge.app/app** (Devnet product) |
| Hackathon | Encode Club Solana Hackathon 2026 · readiness checklist: [docs/encode-readiness.md](docs/encode-readiness.md) |
| Tracks | **Best Consumer App on Solana** · **Best Use of x402 on Solana** (x402 is *planned / under evaluation*, not integrated; see below) |
| Repo | [msourial/SkyHedge-Sol @ seeker-revamp](https://github.com/msourial/SkyHedge-Sol/tree/seeker-revamp) |
| APK | See [Releases](https://github.com/msourial/SkyHedge-Sol/releases) (Devnet build; SHA-256 in the release notes). Local release path: `mobile/android/app/build/outputs/apk/release/app-release.apk` |
| Demo | `<<DEMO_VIDEO_URL>>` · script: [docs/demo-script.md](docs/demo-script.md) |
| Pitch deck | [docs/submission/skyhedge-encode-deck.pdf](docs/submission/skyhedge-encode-deck.pdf) · pack: [docs/submission/](docs/submission/) |
| Encode pack | Description, problem/solution, stack, Devnet status, team, links under [docs/submission/](docs/submission/) |
| Program (Devnet) | `5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx` |
| Test token | `SKYT` mint `3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g` (Devnet, no value) |

**On-chain proof:** a real `OpenPosition` purchase from the Seeker through Phantom, finalized on Devnet:
[`5TjACP1S…7qsPWycH`](https://explorer.solana.com/tx/5TjACP1ScQxXRP4GNpA5zXqxAHK2iCNvcETPx1z7rJ4qXPjMWXZ6qXgngHjrPGv9sVL1h6nGULmzwCiu7qsPWycH?cluster=devnet)

> **History:** SkyHedge was first built for the Solana Mobile **Clock In** hackathon (October 2026). That entry's notes remain in [docs/clock-in-readiness.md](docs/clock-in-readiness.md) and [docs/clock-in-submission-draft.md](docs/clock-in-submission-draft.md).

## For judges

**What it is.** SkyHedge sells parametric weather protection: a fixed payout that triggers automatically when public weather data crosses a pre-set threshold (for example, at least 50 mm of rain in Des Moines over a 7-day window). There is no claims process; the data decides.

**Quick start.**
1. Open **https://skyhedge.app** (waitlist) or **https://skyhedge.app/app** (Devnet product). Or install the Android APK on a Seeker / Android phone ([Releases](https://github.com/msourial/SkyHedge-Sol/releases)).
2. Phantom → Settings → Developer Settings → **Testnet Mode** → Solana **Devnet**. Need Devnet SOL (fees) and SKYT (premiums).
3. Demo path: landing **Rain on your plans? Get paid.** → **Open web app** → Seeker **Markets** (New York **Open**) → **Protect** expiry **Nov 1 · W**, the priced trigger row, **100 SKYT** → Phantom `open_position` → coverage ticket and Wallet balance → NOAA final data or a DataUnavailable refund. Shot list: [docs/demo-script.md](docs/demo-script.md). Local edit target: `~/Documents/Codex/demo-assets/skyhedge-encode-demo.mp4`.
4. Without SKYT you can still browse markets, quotes, and live NOAA data.

**How Solana powers it.**
- **Anchor program** (`anchor/programs/skyhedge_protection`) holds every rule: market creation, pricing inputs, purchases, settlement, payouts and refunds.
- **Per-market vaults:** each city market has its own fully collateralized, PDA-owned token vault. A purchase is rejected unless the vault covers every reserved payout.
- **SKYT** is a valueless six-decimal Devnet test token used as collateral; no real money is involved.
- **Mobile Wallet Adapter + Phantom:** the server builds the transaction unsigned and the user approves it in Phantom on the phone. Nothing is signed without the user.
- **Settlement:** the final NOAA observation is normalized, hashed and committed on-chain; if the trigger is hit the buyer claims the payout, and if data is unavailable premiums are refundable. Permissionless `settle_market` / `mark_data_unavailable` after gates are in the `seeker-revamp` program source (Devnet upgrade may still be pending).

**Current live status (Devnet).**
- **Website:** https://skyhedge.app — Storm Glass waitlist; product UI at `/app`. MapTiler key configured in Vercel production. Waitlist: `DATABASE_URL` + migrations `0002`/`0003`, plus `ADMIN_TOKEN` / `IP_HASH_SALT` for export — see `docs/waitlist-backend.md`.
- **New York:** the Encode camera path. On 18 Oct 2026 the Seeker showed New York **Open**, with **Nov 1 · W** as the priced weekly expiry. Read the live row for the trigger, chance, and price. Do not copy a number from this README onto a later recording if the screen has moved.
- **Des Moines:** still has open Devnet windows in the status API. It is not the demo path.
- **Soon on the first Markets screen (18 Oct 2026):** Chicago, Miami, Dallas–Fort Worth, Los Angeles. Toronto stays closed. Wind, snow, and heat have no prices.

**x402 (Best Use of x402 track).** x402 is **not integrated yet**. It is planned and under evaluation, for example for pay-per-request access to premium weather feeds. Today the app only checks a free WeatherXM health endpoint, and x402-paid data is never used for settlement.

No traction numbers are claimed; SkyHedge is pre-launch.

## Why

Weather decides whether a flight leaves, a crane lifts, a haul road stays open, an outdoor wedding happens, or a harvest pays. Traditional weather cover is slow, paperwork-heavy, sold in large minimum sizes, and out of reach for most small operators. SkyHedge is **instant** (quote and buy in under a minute), **accessible** (a phone and a wallet are enough), and **fractional** (no minimum policy size).

- **Aviation (lead wedge):** operators, flight schools and charters that lose revenue on weather days.
- **Agriculture (the heart of the story):** the farmer whose season depends on rainfall they can't control.
- Also: construction, mining, and events and weddings.

**Business model:** a **1% protocol fee** on every purchase, included in the quoted premium and shown on the ticket. SkyHedge is pre-launch, so no traction numbers are claimed.

## Key features

- **Protect flow:** an expiry chain. Pick a date such as **Nov 1 · W**, the one priced trigger row, and coverage of **50 / 100 / 250 / Max SKYT**. The button reads **Protect for … SKYT** only with a live price, then Phantom approves `open_position`.
- **Markets:** New York leads the Seeker list and shows **Open** while a window is selling. Toronto stays closed. Wind, snow, and heat have no prices.
- **Phantom via Mobile Wallet Adapter on Devnet:** the server builds the transaction unsigned, and the user approves it in their wallet. Nothing is signed without the user.
- **On-chain positions** through the Anchor program, **one per wallet per market window**. After purchase the app shows "You're protected" with the finalized status and an **Explorer link**.
- **Settlement:** the final observation is normalized, hashed and committed on-chain. If the trigger is hit, the buyer claims the fixed payout. If source data is unavailable after a 7-day grace period, the market resolves `DATA_UNAVAILABLE` and premiums are refundable. SkyHedge never makes up weather values.
- **Built for mobile networks:** API reads retry with timeouts. Balances are read directly from Solana RPC with a fallback to a second Devnet endpoint (genesis-hash checked). Friendly errors and an offline state with Retry replace endless spinners.

## How it works

```
Pick place + risk  →  NOAA / Environment Canada data  →  quote (premium, payout, chance)
      →  approve in wallet (MWA)  →  Anchor program on Devnet holds premium + vault
      →  final observation hashed on-chain  →  automatic payout or premium refund
```

Pricing uses ten analogous NOAA windows plus a forecast signal, a 15% risk load and the 1% fee. Markets come from a per-market counter, and city, station and provider are stored as hashes, so **adding Toronto needs no program change** (see [docs/canadian-market-plan.md](docs/canadian-market-plan.md)).

## Money flow

Each city market has its own fully collateralized vault (a PDA-owned SPL token account). Liquidity providers take the other side of every protection position; there is no order book or outside counterparty. Everything below is enforced by `anchor/programs/skyhedge_protection/src/lib.rs`.

```mermaid
flowchart LR
  LP["Liquidity providers"] -- "deposit (fund_pool)" --> V[("Market vault<br/>one per city")]
  V -. "shares, 1:1 with deposit" .-> LP
  B["Buyer"] -- "premium (open_position)<br/>only if the vault covers every reserved payout" --> V
  SA["Settlement authority"] -- "NOAA observation, source-hashed<br/>(submit_weather_observation)" --> P{{"settle_market"}}
  P -- "trigger hit" --> C["Buyer claims payout<br/>(claim_payout)"]
  SA -- "no valid NOAA data by the deadline<br/>(mark_data_unavailable)" --> R["Buyer reclaims premium<br/>(claim_premium_refund)"]
  V --> C
  V --> R
  V -- "close_market (admin, after claim deadline):<br/>1% protocol fee" --> F[("Protocol fee vault")]
  V -- "everything left, pro rata<br/>(redeem_closed_liquidity)" --> LP
```

- **Funding.** Any wallet can `fund_pool` while a market is Draft or Open and before sales close, up to the market's liquidity cap; LP shares are 1:1 with SKYT deposited. `withdraw_liquidity` is allowed in the same window only if the vault still covers reserved exposure.
- **Buying.** `open_position` charges `premium = ceil(protected_amount × premium_rate_bps / 10,000)`, where `premium_rate_bps = ceil(probability_bps × 1.15) + 100`. The 1% protocol fee (1% of the protected amount) is part of the premium and is only accrued, not moved. The purchase reserves the full payout and is rejected unless the vault, including the new premium, covers all reserved exposure and stays within the market's exposure and per-wallet caps.
- **Settlement.** The settlement authority posts one NOAA observation that must match the market's station hash, methodology hash and window and carry a non-zero source hash. Once that observation exists, **anyone** may call `settle_market` (deterministic). If the trigger is hit, the buyer claims the payout; if not, premiums stay for LPs. After the data deadline with **no** observation, **anyone** may call `mark_data_unavailable` so buyers reclaim premiums (protocol fee waived). These permissionless paths are in `seeker-revamp` source; Devnet upgrade may still be pending.
- **Close.** After the claim deadline the admin calls `close_market`: the accrued 1% fee moves to the protocol fee vault (zero when data was unavailable) and everything left in the vault is redeemable by LPs pro rata.
- **Who signs.** The protocol admin wallet creates, opens (needs at least one LP share) and closes markets; the settlement authority posts observations; LPs and buyers sign their own deposits, purchases and claims. Funding is not admin-gated on chain; on Devnet the admin wallet seeds the first liquidity.
- **Collateral.** Devnet uses the valueless six-decimal SKYT test token; no real money is involved.

## Pricing model

**Live today:** premium rate = ceil(rain probability × 1.15) + 1% fee, charged on the coverage amount. Rain probability comes from NOAA: 70% from hits in the 10 matching past windows and 30% from the NOAA forecast, clamped between 1% and 90%. **Proposed (not yet in the program):** replace the flat 1% with a risk-based fee. Changing it needs an on-chain program update.

```mermaid
flowchart TB
  subgraph DATA["1. Rain probability p (NOAA)"]
    H["10 past NOAA windows<br/>hit rate × 70%"] --> P["p, clamped 1%–90%"]
    F["NOAA forecast hit<br/>× 30%"] --> P
  end
  P --> FAIR["Fair cost = p × coverage"]
  FAIR --> LOAD["+ 15% risk load<br/>(goes to LP vault)"]
  P --> FEE
  subgraph FEE["2. SkyHedge fee"]
    direction TB
    NOW["Today: flat 1% of coverage"]
    NEW["Proposed: risk-based<br/>Polymarket-style curve<br/>coverage × rate × p × (1 − p)<br/>peaks at 50/50, near 0 at extremes"]
    TIER["Proposed tiers for small tickets<br/>low / medium / high risk = 2% / 4% / 6%<br/>about 5% on a $50 ticket"]
    NOW -. "replaced by" .-> NEW
    NEW --- TIER
  end
  LOAD --> PREM["Premium the buyer pays"]
  FEE --> PREM
  subgraph LIMITS["3. Coverage limits (in code)"]
    W["max 500 SKYT per wallet"]
    M["max 8,000 SKYT exposure per market"]
    L["max 10,000 SKYT liquidity per market"]
  end
  LIMITS -. "checked before purchase" .-> PREM
  PREM --> VAULT[("City market vault<br/>funded by LPs")]
  VAULT -- "trigger hit: payout" --> BUYER["Buyer"]
  VAULT -- "fee at close" --> FV[("Protocol fee vault<br/>= SkyHedge revenue")]
  VAULT -- "remainder" --> LPS["Liquidity providers"]
```

Payouts come from the liquidity providers' vault, not from SkyHedge. SkyHedge's revenue is only the fee, so it carries no weather risk unless it also provides liquidity. Limits come from `scripts/seed-markets.ts`, and the formula comes from `anchor/programs/skyhedge_protection/src/lib.rs` and `server/services/quote-engine.ts`. The fee tiers are a modeling proposal.

## Install

**APK:** download it from [Releases](https://github.com/msourial/SkyHedge-Sol/releases). A release for build `e5ca97a` is coming. Install with `adb install SkyHedge-ClockIn.apk` or sideload it on the Seeker.

**Wallet setup:** in Phantom, open Settings → Developer Settings, turn on **Testnet Mode**, and set Solana to **Devnet**. You need Devnet SOL for fees and SKYT for premiums.

**Build from source:**

```bash
npm install
npm run check          # typecheck (root)
npm run test:server    # server tests

cd mobile
npm install
npm run check          # typecheck (mobile)
npm run test:mobile    # mobile tests (see Tests below)
EXPO_PUBLIC_API_BASE_URL=https://skyhedge.app npx expo prebuild --platform android
cd android && EXPO_PUBLIC_API_BASE_URL=https://skyhedge.app ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

`EXPO_PUBLIC_API_BASE_URL` is baked in at build time and falls back to `https://skyhedge.app`. `EXPO_PUBLIC_SKYT_MINT` can override the SKYT mint. For the full developer reference (env vars, localnet, Devnet activation, API, security posture), see [docs/developer-reference.md](docs/developer-reference.md).

**Run the web app and API locally (Devnet, read-only until a wallet signs):**

```bash
cp .env.example .env      # optional; fill only what you need
SKYT_MINT=3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g npm run dev   # http://localhost:5000 (PORT overrides)
npm run build && npm start                                          # production bundle in dist/
```

Without `SKYT_MINT` the server reads status but will not prepare transactions. Without `SOLANA_RPC_URL` it falls back to the public Devnet RPCs, which rate-limit (HTTP 429); set a private Devnet RPC URL for anything beyond a quick check. `DATABASE_URL` and `NOAA_TOKEN` are optional: without them `/api/markets` reports the read model as deferred (open windows come from `/api/devnet/status`) and live NOAA weather reads return `DATA_UNAVAILABLE`.

## Tech stack

- **Mobile:** Expo / React Native (Android), `@solana-mobile/mobile-wallet-adapter-protocol-web3js`, `@solana/web3.js`
- **Chain:** Anchor program `skyhedge_protection` on Solana Devnet, SPL token SKYT
- **Server:** Node / Express (TypeScript): quote engine, NOAA and ECCC providers, evidence builder, unsigned-transaction builder, settlement runner. Deployed on Vercel.
- **Web:** React + Vite operator console

## Repo layout

```
mobile/    Expo / React Native Android app (Markets · Protect · Wallet), MWA, direct Solana RPC reads
server/    Express API: quote engine, NOAA + ECCC providers, evidence, unsigned-tx builder, settlement
anchor/    Anchor program skyhedge_protection (markets, vaults, positions, settlement, claims)
client/    Web companion / operator console (React + Vite), skyhedge.app
shared/    IDL, methodology, optional Postgres schema
docs/      demo script, pitch deck, submission draft, plans, takeover log
```

## Architecture (high level)

```mermaid
flowchart TB
  subgraph clients [Clients]
    Seeker["Seeker app RN Android"]
    Web["skyhedge.app waitlist plus /app"]
  end
  subgraph api [Vercel API]
    Quote["Quote engine NOAA ECCC"]
    Unsigned["Unsigned tx builder"]
    Waitlist["Waitlist Neon Postgres"]
  end
  subgraph chain [Solana Devnet]
    Prog["Anchor skyhedge_protection"]
    Vault["Per-city SKYT vault PDA"]
    Obs["Settlement observation PDA"]
  end
  Seeker --> Quote
  Seeker --> Unsigned
  Web --> Waitlist
  Unsigned --> Seeker
  Seeker -->|"MWA Phantom approve"| Prog
  Prog --> Vault
  Quote --> Seeker
  Prog --> Obs
```

## Oracle failure handling

| Failure | Behavior |
| --- | --- |
| Incomplete / flagged NOAA days | Rejected off-chain; never synthesized into rainfall |
| No valid observation by `data_deadline` | `mark_data_unavailable` (permissionless after deadline) → buyers `claim_premium_refund` |
| Observation posted but settle stalled | `settle_market` permissionless once observation PDA exists |
| API / parser outage | Fail-closed; cron retries; 503 guidance — no alternate settlement source |
| NOAA revises after settle | Settled markets are final (7-day data grace before deadline; no reopen path in V1) |

Details: [docs/oracle-failure-plan.md](docs/oracle-failure-plan.md).

## Tests

```bash
npm run check                 # root typecheck
npm run test:server           # quote, NOAA/ECCC, waitlist, settlement
npm run test:ui               # Playwright (npx playwright install chromium once)
cd mobile && npm run check && npm run test:mobile
npm run solana:test           # cargo-build-sbf + Anchor Rust tests (incl. permissionless_resolution)
```

## Status & honesty

Devnet only. SKYT is a test token. SkyHedge is a parametric weather hedge and not a regulated product. No traction numbers are claimed. Encode team: **solo**.

## License

[MIT](LICENSE)
