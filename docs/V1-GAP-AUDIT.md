# SkyHedge V1 gap audit

Audited: 2026-09-29

## Verified deployment state

- **Public interface:** `https://skyhedge.vercel.app` is live. Production `/api/health` and `/api/devnet/status` were queried directly on 2026-09-29.
- **Devnet program:** `5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx` is executable and upgradeable. Authority `7zfJ9sYr1x2kA5qMkBAMd1DmFGZcdE6HzBNAutWkHF2c` remains the upgrade authority. The deployed 22-instruction IDL matches the committed IDL and includes empty-Draft cancellation; production status reports this capability verified.
- **Protocol and mint:** the protocol is initialized, unpaused, and points to the configured admin, settlement authority, and six-decimal SKYT mint. Finalized supply is 350,000 SKYT.
- **NOAA credentials:** production health reports NOAA configured. The live status endpoint returns a historical station-evidence package separately from current exact-window five-day quote terms. Neither artifact is a future settlement observation.
- **Persistence:** PostgreSQL is intentionally deferred. For Devnet V1, finalized Solana accounts and transactions are the source of truth; the API now exposes direct finalized-RPC status for the builder proof. A read-model indexer is a later performance and analytics enhancement only.
- **Des Moines:** market ID 0 is a finalized expired `Draft` with zero vault balance. Its immutable dates and quote-input hash do not match the current NOAA seed terms; it cannot safely be resumed. Its on-chain cancellation instruction rechecks zero balances and liabilities. The admin wallet must approve cancellation before the Builder can seed market ID 1.
- **Settlement automation:** production health reports NOAA configured, but no settlement signer or cron authentication is configured. Oracle automation and a real payout/refund lifecycle remain incomplete.
- **Local verification:** 114 server tests pass; four focused hazard-selection browser tests pass; TypeScript and production builds pass. The production site was redeployed and its live finalized-RPC status was verified. A new market lifecycle still awaits admin-wallet approvals.

## What is now aligned

- The active web experience presents a 12-area agricultural rainfall catalog, with Des Moines as the only Devnet activation target. Wind gust and snowfall are exposed as research-only protection types without quote or transaction paths.
- The active navigation no longer exposes options chains, community governance, or staking.
- The browser supports only Phantom and Solflare adapters; the demo wallet is no longer registered.
- The interface handles unavailable weather, quote, indexer, and portfolio data explicitly rather than substituting values.
- The active UI labels the product as Devnet and NOAA-only, and separates unsigned transaction preparation from wallet approval. WeatherXM is supplemental context only; it does not participate in settlement.

## Product-critical work still required

### Deployment and chain truth

- Program and IDL deployment are verified. `SKYHEDGE_DEVNET_CANCEL_EMPTY_DRAFT_READY=true` is enabled in Vercel Production after verifying the deployed instruction and matching IDL. The connected protocol-admin wallet must still approve cancellation of market ID 0. Then the Builder can create, fund with 2,000 SKYT, and open market ID 1 from current finalized NOAA terms.
- The current six-decimal Devnet SKYT mint is `3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g`, with 350,000 supply and admin mint authority. No further issuance is planned.
- The protocol is already initialized with admin `DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y` and separate settlement signer `AVe5ULAoAyDaXAPS7s2sAUJo7A2QmDuph9Nwyrm9v5Vh`.

### V1 protocol integrity

- The active settlement path is NOAA-only. Only Des Moines is the first Devnet activation target; the wider agricultural catalog remains evidence-gated. The active customer flow does not expose legacy options, governance, staking, or demo-wallet actions. Historic database columns still need a final removal migration before V1 release.
- No open/seeded Des Moines market exists yet. Market ID 0 is an expired Draft with stale immutable quote terms; recovery now requires the admin-wallet cancellation approval, followed by fresh create/fund/open approvals.
- Contract and local-validator test evidence is still needed for controls, exposure, funding/withdrawal, payout/refund, fee, close, and replay cases specified in the V1 plan.

### Service and transaction work

- PostgreSQL is now optional for Devnet V1 health and builder status. Portfolio and evidence history still need direct-RPC replacements before customer-facing position views can be considered live.
- The advisory-only endpoint and native guide now extract structured intent and check research/finalized-market state. They do not prepare quotes or transactions; the guide needs server-side Anthropic configuration to answer. The protection form still calls the authoritative quote endpoint only after its existing gates pass.
- Saskatoon and Toronto remain research-only. Candidate NOAA stations are not pinned; Canadian data-use rights, hourly local-day completeness, ten historical windows, exact-window GFS forecast, and market funding have not passed release validation. See `docs/canadian-pilot-gates.md`.
- Transaction preparation must be wired to the deployed Anchor IDL only after an explicit user approval. The interface intentionally keeps liquidity actions unavailable until then.
- The quote panel needs a successful NOAA-backed integration test with immutable source/methodology hashes, forecast inputs, and claim deadline proof.

## Release gate

Do not market the public URL as a live protection protocol until the protocol PDA, NOAA service, first Des Moines market, direct-RPC account reads, and complete end-to-end transaction lifecycle have each been verified.

## Inputs required from the project owner

1. Admin-wallet approval for empty-Draft cancellation, followed by create/fund/open approvals for the fresh market.
2. Settlement-signer keypair and cron-auth secret configuration before automated NOAA settlement can run.
3. Hosting choice for the always-on NOAA settlement worker. Vercel currently reports the worker as manual/missing until its signer and cron authentication are configured.
