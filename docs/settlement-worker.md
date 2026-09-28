# Devnet settlement worker

SkyHedge's production site runs on Vercel Functions, so its NOAA settlement worker is invoked by a daily Vercel Cron rather than relying on an always-running server process. The job calls `/api/cron/settlement` at 03:00 UTC and reads finalized Solana state before it advances a market, submits NOAA evidence, settles, or marks data unavailable. It never invents rainfall values.

## Vercel environment setup

Add these as encrypted Vercel Production environment variables; do not commit them or paste them into chat:

- `SETTLEMENT_AUTHORITY_KEYPAIR`: the settlement authority's 64-byte secret key encoded as a JSON integer array. Locally, the existing variable may continue to point at the ignored keypair JSON file.
- `NOAA_TOKEN`: NOAA API credential used by the observation reader.
- `CRON_SECRET`: a randomly generated secret with at least 16 characters. Vercel sends it as `Authorization: Bearer <CRON_SECRET>` for scheduled invocations.

The configured signer must correspond to the on-chain settlement authority (`AVe5ULAoAyDaXAPS7s2sAUJo7A2QmDuph9Nwyrm9v5Vh`). Never use the admin wallet key as a substitute. After the Production variables are saved, redeploy the production branch so Vercel registers the cron and includes the configuration.

## Verifying operation

- `/api/health` reports the settlement worker as `configured` only when signer, NOAA, and cron-auth configuration are all present.
- Vercel Cron runs only on production deployments. Check the Vercel Cron Jobs page and the function's runtime logs after deployment.
- The current schedule is once per day so it is valid on Vercel Hobby. Hobby timing is approximate (within the scheduled hour); the worker uses finalized on-chain timestamps and retries on its next invocation. Vercel Pro and Enterprise allow more frequent schedules if faster settlement operations are needed.
- A successful response contains public market addresses and transaction signatures. A failure response deliberately omits exception details and secrets; inspect the redacted runtime log and the next scheduled retry.

This worker only attests to complete NOAA observations for the market's pinned station and immutable window. It rejects missing GHCN-Daily quality attributes, nonblank NOAA quality-failure flags, and measurement flags that cannot be allocated to one daily value. A blank quality flag means the record did not fail NOAA's documented quality checks; it is not a promise that NOAA will never revise the record. The settlement signer is an authorized SkyHedge attestor; Solana verifies that authorization and market rules, but does not independently prove NOAA's real-world report.

For a valid observation, the worker submits the observation and deterministic market settlement as two instructions in one finalized transaction. If either instruction fails, neither state change is committed; a later cron run can retry without leaving an observation account that prevents the `DATA_UNAVAILABLE` path.

Vercel references: [Cron Jobs](https://vercel.com/docs/cron-jobs), [securing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs), and [function duration limits](https://vercel.com/docs/functions/configuring-functions/duration#duration-limits).
