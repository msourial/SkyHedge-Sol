# SkyHedge V1 gap audit

Audited: 2026-09-29

## Verified deployment state

- **Public interface:** production URL and Vercel environment were not re-verified in this audit. Do not infer its API configuration from local `.env`.
- **Devnet program:** `5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx` is executable and upgradeable. Authority `7zfJ9sYr1x2kA5qMkBAMd1DmFGZcdE6HzBNAutWkHF2c` matches the local upgrade signer. The deployed IDL has 21 instructions; the committed IDL has 22 and adds empty-Draft cancellation.
- **Protocol and mint:** the protocol is initialized, unpaused, and points to the configured admin, settlement authority, and six-decimal SKYT mint. Finalized supply is 350,000 SKYT.
- **NOAA credentials:** a local NOAA token is configured and the current local API returns a real historical evidence package plus a separate exact-window five-day quote package. Production NOAA credentials were not verified.
- **Persistence:** PostgreSQL is intentionally deferred. For Devnet V1, finalized Solana accounts and transactions are the source of truth; the API now exposes direct finalized-RPC status for the builder proof. A read-model indexer is a later performance and analytics enhancement only.
- **Des Moines:** market ID 0 is a finalized empty `Draft` with zero vault balance, shares, and liabilities. Its immutable dates and quote-input hash do not match the currently available NOAA seed terms; it cannot safely be resumed. The admin must cancel it after the matching program and IDL upgrade, then seed market ID 1 using fresh NOAA terms.
- **Local verification:** 114 server tests pass; the empty-Draft cancellation Anchor unit and ProgramTest integration tests pass; three focused multi-hazard browser tests pass; TypeScript and production builds pass. A Devnet upgrade is still pending.

## What is now aligned

- The active web experience presents fixed-payout rainfall protection for New York, Miami, and Chicago.
- The active navigation no longer exposes options chains, community governance, or staking.
- The browser supports only Phantom and Solflare adapters; the demo wallet is no longer registered.
- The interface handles unavailable weather, quote, indexer, and portfolio data explicitly rather than substituting values.
- The active UI labels the product as Devnet and NOAA-only, and separates an unsigned-transaction capability from a real wallet approval.

## Product-critical work still required

### Deployment and chain truth

- The program upgrade and deployed-IDL upgrade remain pending. The deployer currently has 2.431658 SOL; the current program buffer requires about 2.468 SOL plus transaction-fee reserve. A 0.1-SOL Devnet faucet request was rate-limited by both public Devnet and the configured RPC; no balance change occurred.
- After the program and IDL upgrade, enable the explicit `SKYHEDGE_DEVNET_CANCEL_EMPTY_DRAFT_READY=true` release gate only after final verification. The connected protocol-admin wallet must sign cancellation of market ID 0. Then the Builder can create, fund with 2,000 SKYT, and open market ID 1 from current finalized NOAA terms.
- The current six-decimal Devnet SKYT mint is `3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g`, with 350,000 supply and admin mint authority. No further issuance is planned.
- The protocol is already initialized with admin `DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y` and separate settlement signer `AVe5ULAoAyDaXAPS7s2sAUJo7A2QmDuph9Nwyrm9v5Vh`.

### V1 protocol integrity

- The active routes and settlement path are now NOAA-only and restricted to New York, Miami, and Chicago. Legacy options, governance, staking, demo-wallet, and WeatherXM implementation files have been removed. Historic database columns still need a final removal migration before V1 release.
- No open/seeded Des Moines market exists yet. Market ID 0 is an empty Draft with stale immutable quote terms; its recovery and replacement require the on-chain program/IDL upgrade followed by an admin-wallet cancellation approval.
- Contract and local-validator test evidence is still needed for controls, exposure, funding/withdrawal, payout/refund, fee, close, and replay cases specified in the V1 plan.

### Service and transaction work

- PostgreSQL is now optional for Devnet V1 health and builder status. Portfolio and evidence history still need direct-RPC replacements before customer-facing position views can be considered live.
- The advisory endpoint described by the V1 design has not been implemented; the current protection form calls the quote endpoint directly.
- Transaction preparation must be wired to the deployed Anchor IDL only after an explicit user approval. The interface intentionally keeps liquidity actions unavailable until then.
- The quote panel needs a successful NOAA-backed integration test with immutable source/methodology hashes, forecast inputs, and claim deadline proof.

## Release gate

Do not market the public URL as a live protection protocol until the protocol PDA, NOAA service, first Des Moines market, direct-RPC account reads, and complete end-to-end transaction lifecycle have each been verified.

## Inputs required from the project owner

1. At least 0.1 additional free Devnet SOL to give the upgrade signer adequate buffer-rent and fee headroom; faucet requests were rate-limited during this run.
2. Admin-wallet approval for empty-Draft cancellation, followed by create/fund/open approvals for the fresh market.
3. Vercel production configuration and the deployment result must be checked before claiming public production readiness.
4. Hosting choice for the always-on NOAA settlement worker. A static Vercel site alone cannot run the durable worker.
