# Feasibility plan

Scope: isolated SDK 0.2.0 devnet lifecycle; existing applications and program stay unchanged.

1. Pin NOAA station USW00094728, 2026-10-01 station daily PRCP, metric, strike >= 1.0 mm. Require exactly one matching record, numeric nonnegative PRCP and blank quality flag. Record source response and hash. Observation day is already published; this is a mechanics demonstration with a known outcome.
2. Create one 600-second market, seed 50 mUSDC, buy YES and NO from distinct wallets for 5 mUSDC each. Use upstream fee-aware quotes and minimum output.
3. After chain expiry fetch NOAA again, resolve with creator, claim winner and LP residuals. Save every successful signature and balance/price measurements immediately. Never automatically retry an ambiguous transaction.
4. If funding or network blocks progress, record evidence and stop the affected operation; do not create replacement markets or rotate wallets to bypass limits.
5. Inspect web/mobile/server integration boundaries, document measured feasibility and estimated migration effort. Review diff for requirements, safety and evidence; fix findings and commit locally.

Acceptance: one confirmed market, both trades, NOAA-derived resolution, winning claim, LP claim where supported; or explicit blockers distinguishing attempted operations from confirmed ones. Keys outside repository, no root dependency or app changes, no push/deploy.
