# SkyHedge V1 gap audit

Audited: 2026-09-10

## Verified deployment state

- **Public interface:** `https://skyhedge.vercel.app` is deployed as a static Vite site. It has no Vercel production environment variables, so it has no API base URL or service credentials.
- **Devnet program:** the configured address `7thTyPBaVCEBL2z28ojTxfmrbNMydXV3EAgbYgrz7GKr` returns `AccountNotFound` from public Solana Devnet. No deployable program-keypair file is present in the repository; the required keypair is intentionally ignored.
- **Weather credentials:** NOAA Climate Data Online requires a token. The repository has no `NOAA_TOKEN`, and therefore its final-observation and real quote paths must remain unavailable.
- **Persistence:** no `DATABASE_URL` is configured. The finalized-slot indexer has nowhere durable to write markets, positions, evidence, events, or replay checkpoints.
- **Local test state:** 13 V1-focused service tests pass. The Anchor integration suite could not start because an existing local validator owns port 8899; that process was left untouched.

## What is now aligned

- The active web experience presents fixed-payout rainfall protection for New York, Miami, and Chicago.
- The active navigation no longer exposes options chains, community governance, or staking.
- The browser supports only Phantom and Solflare adapters; the demo wallet is no longer registered.
- The interface handles unavailable weather, quote, indexer, and portfolio data explicitly rather than substituting values.
- The active UI labels the product as Devnet and NOAA-only, and separates an unsigned-transaction capability from a real wallet approval.

## Product-critical work still required

### Deployment and chain truth

- The configured Devnet program address has not been verified as a deployed `skyhedge_protection` program. The deployment must create a fresh program ID, publish its IDL, and make `/api/health` the sole source for network identity.
- The public Vercel build is a static interface. It needs a deployed API base URL, a PostgreSQL instance, finalized-slot indexer, and configured NOAA credentials before it can present live markets, evidence, or portfolios.
- Real Devnet SKYT mint creation, funding, and wallet balance reads remain unverified.
- The missing deployment authority choices are material: the admin/deployer public key, a separate settlement-service signer, and a safe custody/rotation process must be selected before a new immutable program ID can be generated and funded.

### V1 protocol integrity

- The active routes and settlement path are now NOAA-only and restricted to New York, Miami, and Chicago. Legacy options, governance, staking, demo-wallet, and WeatherXM implementation files have been removed. Historic database columns still need a final removal migration before V1 release.
- The committed README and `.env.example` still describe six-decimal USDC, while the V1 product plan specifies six-decimal SKYT. Resolve the collateral/mint decision before minting or deploying.
- Contract and local-validator test evidence is still needed for controls, exposure, funding/withdrawal, payout/refund, fee, close, and replay cases specified in the V1 plan.

### Service and transaction work

- The advisory endpoint described by the V1 design has not been implemented; the current protection form calls the quote endpoint directly.
- Transaction preparation must be wired to the deployed Anchor IDL only after an explicit user approval. The interface intentionally keeps liquidity actions unavailable until then.
- The quote panel needs a successful NOAA-backed integration test with immutable source/methodology hashes, forecast inputs, and claim deadline proof.

## Release gate

Do not market the public URL as a live protection protocol until the Devnet program, API/indexer, NOAA credentials, SPL mint, and complete end-to-end transaction lifecycle have each been verified.

## Inputs required from the project owner

1. NOAA CDO token (created by the owner using their email at NOAA; never paste it into Git).
2. Neon Postgres connection string, or approval to create a new Neon project under the owner's account.
3. Deployment choice: owner wallet as protocol admin and a separately generated settlement-authority public key.
4. A decision to use **SKYT** as specified in V1 or intentionally change the specification to **USDC**.
5. Hosting choice for the always-on API/indexer/settlement worker. A static Vercel site alone cannot run the durable worker.
