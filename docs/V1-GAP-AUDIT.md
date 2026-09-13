# SkyHedge V1 gap audit

Audited: 2026-09-10

## Verified deployment state

- **Public interface:** `https://skyhedge.vercel.app` is deployed as a static Vite site. It has no Vercel production environment variables, so it has no API base URL or service credentials.
- **Devnet program:** `5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx` is executable on Devnet. Its current upgrade authority is `7zfJ9sYr1x2kA5qMkBAMd1DmFGZcdE6HzBNAutWkHF2c`, not the protocol-admin wallet.
- **Weather credentials:** NOAA Climate Data Online requires a token. The repository has no `NOAA_TOKEN`, and therefore its final-observation and real quote paths must remain unavailable.
- **Persistence:** PostgreSQL is intentionally deferred. For Devnet V1, finalized Solana accounts and transactions are the source of truth; the API now exposes direct finalized-RPC status for the builder proof. A read-model indexer is a later performance and analytics enhancement only.
- **Local test state:** 13 V1-focused service tests pass. The Anchor integration suite could not start because an existing local validator owns port 8899; that process was left untouched.

## What is now aligned

- The active web experience presents fixed-payout rainfall protection for New York, Miami, and Chicago.
- The active navigation no longer exposes options chains, community governance, or staking.
- The browser supports only Phantom and Solflare adapters; the demo wallet is no longer registered.
- The interface handles unavailable weather, quote, indexer, and portfolio data explicitly rather than substituting values.
- The active UI labels the product as Devnet and NOAA-only, and separates an unsigned-transaction capability from a real wallet approval.

## Product-critical work still required

### Deployment and chain truth

- The Devnet program account is executable. The remaining chain gate is protocol initialization, upgrade-authority rotation, and one seeded NOAA-pinned Des Moines market.
- The public Vercel build is a static interface. It needs a deployed API base URL and configured NOAA credentials before it can present live weather evidence. It can read live builder status from finalized Solana RPC without PostgreSQL.
- The six-decimal Devnet SKYT mint is created at `3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g`. Current supply is zero; mint authority is `DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y`.
- Authority configuration is prepared: protocol admin `DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y`, and separate settlement signer `AVe5ULAoAyDaXAPS7s2sAUJo7A2QmDuph9Nwyrm9v5Vh`. The protocol-admin wallet must personally sign initialization; no service key can substitute for it.

### V1 protocol integrity

- The active routes and settlement path are now NOAA-only and restricted to New York, Miami, and Chicago. Legacy options, governance, staking, demo-wallet, and WeatherXM implementation files have been removed. Historic database columns still need a final removal migration before V1 release.
- The protocol PDA is not initialized yet; owner approval is still required before market seeding.
- Contract and local-validator test evidence is still needed for controls, exposure, funding/withdrawal, payout/refund, fee, close, and replay cases specified in the V1 plan.

### Service and transaction work

- PostgreSQL is now optional for Devnet V1 health and builder status. Portfolio and evidence history still need direct-RPC replacements before customer-facing position views can be considered live.
- The advisory endpoint described by the V1 design has not been implemented; the current protection form calls the quote endpoint directly.
- Transaction preparation must be wired to the deployed Anchor IDL only after an explicit user approval. The interface intentionally keeps liquidity actions unavailable until then.
- The quote panel needs a successful NOAA-backed integration test with immutable source/methodology hashes, forecast inputs, and claim deadline proof.

## Release gate

Do not market the public URL as a live protection protocol until the protocol PDA, NOAA service, first Des Moines market, direct-RPC account reads, and complete end-to-end transaction lifecycle have each been verified.

## Inputs required from the project owner

1. NOAA CDO token (created by the owner using their email at NOAA; never paste it into Git).
2. Hosting choice for the always-on NOAA settlement worker. A static Vercel site alone cannot run the durable worker.
