# SkyHedge — weather protection you can buy from your phone

> **Parametric weather protection on Solana Mobile.** Pick a place and a weather risk, see a NOAA-priced quote, approve it in your wallet, and get paid automatically on-chain when the weather data says the trigger was hit. No claims adjuster, no paperwork.
>
> Solana Mobile **Clock In** hackathon entry · native React Native Android app (not a PWA) · Solana Devnet · Mobile Wallet Adapter.

| | |
|---|---|
| APK | GitHub release on this repo (debug-signed Devnet build; SHA-256 listed in the release notes and in [docs/takeover-log.md](docs/takeover-log.md)) |
| Demo video | `<<DEMO_VIDEO_URL>>` · script: [docs/demo-script.md](docs/demo-script.md) |
| Pitch deck | [docs/clock-in-pitch.pdf](docs/clock-in-pitch.pdf) |
| Program (Devnet) | `5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx` |
| Test token | `SKYT` `3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g` (no value) |

## Why

Weather decides whether a flight leaves, a crane lifts, a mine haul road stays open, a wedding stays outdoors, or a harvest pays. Traditional weather cover is slow, paperwork-heavy, sold in big minimum sizes, and out of reach for most small operators.

**SkyHedge is:**
- **Instant** — quote and buy in under a minute; payout settles automatically from public weather data.
- **Accessible anywhere** — a phone and a wallet are all you need.
- **Fractional** — protect $10 or $10,000 of exposure; no minimum policy size.

**Who it's for**
- **Aviation (lead wedge):** operators, flight schools, and charters losing revenue to weather days.
- **Construction:** pours, lifts, and crews idled by rain and wind.
- **Mining:** haul-road and site shutdowns.
- **Events & weddings:** outdoor dates that rain can ruin.
- **Agriculture (the heart of the story):** the farmer whose season depends on rainfall they can't control.

The live Devnet market today is **cumulative rainfall in Des Moines, Iowa**. Wind and snow triggers for aviation are on the roadmap and are shown as research-only in the app.

**Business model:** a **1% protocol fee** on every protection purchase, included in the quoted premium and shown on the ticket.

## How it works

```
Pick place + risk  →  NOAA / Environment Canada data  →  quote (premium, payout, chance)
      →  approve in wallet (MWA)  →  Anchor program on Devnet holds premium + vault
      →  final observation hashed on-chain  →  automatic payout or premium refund
```

1. **Markets** — browse researched locations and weather risks; see rainfall history.
2. **Protect** — enter an amount; the server prices it from ten analogous NOAA windows plus a forecast signal, with a 15% risk load and the 1% fee. The quote appears as an **option ticket**: what you pay, what you get, trigger, window, chance, fee.
3. **Wallet** — the transaction is built server-side, unsigned, and approved in Phantom, Solflare, or the Seeker wallet through **Mobile Wallet Adapter**. Nothing is signed without the user.
4. **Settlement** — a final NOAA observation is normalized, hashed, and committed on-chain. If the trigger is hit, the buyer claims the fixed payout; if source data is unavailable after a 7-day grace period, the market resolves `DATA_UNAVAILABLE` and premiums are refundable. SkyHedge never makes up weather values.

**Data sources**
- **NOAA** (US): Climate Data Online final daily observations.
- **Environment and Climate Change Canada** (Canada): daily climate API ([`server/services/eccc.ts`](server/services/eccc.ts), tested) — Toronto Pearson, Vancouver, Montréal stations.

## Canada: Toronto opens soon

Markets are created from a per-market counter, and city, station, and data provider are stored as hashes, so **adding Toronto needs no program change**. The app shows Toronto as **"Opens soon"**, and the ECCC adapter is already in the codebase. Plan: [docs/canadian-market-plan.md](docs/canadian-market-plan.md).

## Architecture

```
mobile/    Expo / React Native Android app (Markets · Protect · Wallet), MWA, direct Solana RPC reads
server/    Express API: quote engine, NOAA + ECCC providers, evidence builder, unsigned-tx builder, settlement runner
anchor/    Anchor program skyhedge_protection (markets, vaults, positions, settlement, claims)
client/    Web companion / operator console (React + Vite), deployed at skyhedge.vercel.app
shared/    IDL, methodology, optional Postgres schema
```

Reliability on mobile: API reads retry with timeouts; wallet balances read straight from Solana RPC across two Devnet endpoints (genesis-hash checked); an offline state with Retry replaces endless loading.

## Build & run

```bash
npm install
npm run check          # typecheck (root)
npm run test:server    # server tests

cd mobile
npm install
npm run check          # typecheck (mobile)
npm run test:mobile    # mobile tests
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease   # → app/build/outputs/apk/release/app-release.apk
```

**Testing on a phone:** in Phantom, open Settings → Developer Settings, turn on **Testnet Mode**, and set Solana to **Devnet**. You need Devnet SOL for fees and SKYT for premiums.

**Current tests:** 55 mobile, 163 server, typecheck clean (mobile + root).

Full developer reference (env vars, localnet, Devnet activation, API, security posture): [docs/developer-reference.md](docs/developer-reference.md).

## Status & honesty

- Devnet only. SKYT is a test token. This is not insurance and not a regulated product.
- No traction numbers are claimed here. SkyHedge is pre-launch.
