# SkyHedge V1 gap audit

Audited: 2026-09-10

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

### V1 protocol integrity

- The server still contains legacy option-chain, staking, and governance services/routes. They are not reachable through the active UI but must be deleted or retired before V1 release.
- Server city and NOAA registries still include locations beyond New York, Miami, and Chicago. Restrict the API and settlement allowlist to those three V1 cities.
- The server has WeatherXM-era evidence fields and a `NOAA+WeatherXM` health label. V1 must make NOAA the only final settlement source and remove those fields/claims.
- Contract and local-validator test evidence is still needed for controls, exposure, funding/withdrawal, payout/refund, fee, close, and replay cases specified in the V1 plan.

### Service and transaction work

- The advisory endpoint described by the V1 design has not been implemented; the current protection form calls the quote endpoint directly.
- Transaction preparation must be wired to the deployed Anchor IDL only after an explicit user approval. The interface intentionally keeps liquidity actions unavailable until then.
- The quote panel needs a successful NOAA-backed integration test with immutable source/methodology hashes, forecast inputs, and claim deadline proof.

## Release gate

Do not market the public URL as a live protection protocol until the Devnet program, API/indexer, NOAA credentials, SPL mint, and complete end-to-end transaction lifecycle have each been verified.
