# SkyHedge V1 architecture

SkyHedge V1 is Devnet-only, fixed-payout cumulative-rainfall protection for New York, Miami, and Chicago.

## On-chain state

The `skyhedge_protection` Anchor program uses PDAs for the protocol, market, market vault, fee vault, LP position, protection position, and one settlement observation. A market’s city, NOAA station, methodology/source/quote hashes, trigger, pricing rate, capacity, time windows, and claim deadline are immutable after creation.

Each city market is capped at 10,000 SKYT liquidity, 8,000 SKYT reserved payout exposure, and 500 SKYT coverage per wallet. SKYT has six decimals. Payout equals protected amount when the immutable threshold is met.

Premium rate is `ceil(probability_bps × 1.15) + 100` basis points. The quote probability combines ten analogous NOAA historical windows (70%) and a versioned NOAA forecast signal (30%). The program stores the final calculated rate, while quote inputs and source data are hashed for audit.

## Lifecycle and accounting

`DRAFT → OPEN → LOCKED → AWAITING_SETTLEMENT → SETTLED | DATA_UNAVAILABLE → CLOSED`

LP shares are one-to-one with pre-lock deposits. LP withdrawals are allowed only before lock and cannot leave less collateral than reserved exposure. Protection purchases reserve the full potential payout. The protocol fee is accrued separately and transferred to the protocol fee vault only after the claim deadline.

Winning protection claims transfer SKYT from the market vault once. If NOAA cannot return final source data within seven days, the settlement signer records `DATA_UNAVAILABLE`; buyers may reclaim their premium once. At the immutable deadline—seven days of source grace plus 30 days of claims—the admin closes the market, moves fees to the fee vault, and LPs redeem all remaining assets pro rata.

## Authority and data

Pause blocks new liquidity, withdrawal, and protection opening; it does not block valid claims/refunds. Admin and settlement authority rotation are two-step. The settlement service is a dedicated signer, not the admin wallet.

NOAA is the only V1 data source. The service normalizes daily precipitation into cumulative rainfall, hashes the evidence, and submits once. Source failures become explicit `DATA_UNAVAILABLE` errors; the service never uses fallback, generated, or manual-admin values.

## Off-chain services

PostgreSQL tables in `migrations/0000_skyhedge_chain_state.sql` store finalized chain state, slots, markets, positions, observations, events, quotes, and advisory sessions. The indexer reconciles finalized Solana slots. APIs expose markets, NOAA evidence, quotes, advisory matching, portfolios, and transaction-intent validation. The latter intentionally returns no fabricated transaction before a deployed Anchor IDL is registered.
