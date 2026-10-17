# Rolling weekly and monthly expiries

## Primary goal

A person opening Protect for a live city always finds a real, priced rain window they can buy, with the next weekly and monthly expiries already open.

**How this serves the primary goal:** The phases below replace the single closed demo window with two open ladders, without inventing rainfall, premiums, or a new on-chain instruction.

## Phase 0: Documentation discovery

Allowed, already in the repo:

- `create_market`, `fund_pool`, `open_market` in `anchor/programs/skyhedge_protection/src/lib.rs`. Create and open require `protocol.admin` (`has_one = admin`). A new key cannot seed until it is that admin.
- Premium is derived on-chain from `quote_probability_bps` (`premium_rate_bps`). Do not pass a separate rate.
- Quote math in `server/services/quote-engine.ts`: 10 analogue years, optional NWS QPF, clamp 100–9000 bps.
- Weekly Monday windows already exist in `shared/cities.ts` (`weeklyWindowFor`). Seed schedule in `shared/market-schedule.ts` is the old 24h + 5-day demo and is not the ladder.
- Settlement cron stays `api/cron/settlement.ts`. Do not change claim, refund, or settle instructions.
- Live city today is Des Moines only (`mobile/src/markets-catalog.ts`).

Anti-patterns: no new program instruction, no mainnet, no invented millimetres, no second market for the same observation bounds, no use of the word insurance.

## Phase 1: Ladder model

**How this serves the primary goal:** The app and keeper share one definition of “the next two weekly windows” and “the next two calendar months,” with sales closing at the window start.

Copy date rules into `shared/window-ladder.ts`. Weekly is Monday 00:00 UTC through the next Monday. Monthly is the calendar month in UTC. Depth is 2 per tenor. `planLadderRoll` is idempotent: a non-cancelled market with the same start and end is not created again. Strike is the 8th of 10 NOAA analogue cumulative totals, rounded up to a whole millimetre, and is refused when that value is not positive.

## Phase 2: Keeper

**How this serves the primary goal:** When one expiry’s sales close, the far rung is created with the existing create, fund, and open instructions so Protect never waits on a manual seed.

`scripts/roll-window-ladder.ts` and `GET /api/cron/windows` plan the gaps. Signing stays off unless `KEEPER_SIGN=yes`. The signer must be the current Devnet protocol admin, the RPC must be Devnet, and the mint must be test SKYT. Do not generate a key in this change.

## Phase 3: App

**How this serves the primary goal:** Protect lets someone pick Weekly or Monthly and an expiry, defaulting to the soonest open one, and Markets shows that both ladders are open.

Empty ladders say “Next window opening shortly.” Past windows still settle and still appear in the wallet.

## Phase 4: Verify

**How this serves the primary goal:** Tests prove rollover, no duplicate windows, and no empty dead-end copy before any Devnet signature.
