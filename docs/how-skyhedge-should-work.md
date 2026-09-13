# How SkyHedge Should Work

Last updated: 2026-09-12

## Product thesis

SkyHedge should feel simple to the buyer and verifiable to the Solana ecosystem.

Customer promise:

```text
Crop rainfall risk -> clear protection terms -> deterministic NOAA evidence -> payout or refund
```

Builder proof:

```text
Wallet-approved Devnet actions -> Solana PDAs -> source-hashed NOAA settlement -> Explorer-verifiable lifecycle
```

SkyHedge is not a trading terminal, options exchange, futures venue, staking product, or token investment product. V1 is fixed-payout rainfall protection.

## Primary audiences

**Customer mode** is for non-crypto agricultural buyers, starting with a farm cooperative. It should use plain USD language: protection amount, preview premium, potential payout, rainfall threshold, observation window, evidence status, and claim/refund status.

**Builder mode** is for Solana grant reviewers, ecosystem partners, and technical backers. It should expose the real program ID, IDL status, Devnet network, authority model, PDAs, transaction links, and test collateral controls.

The same protocol can support both audiences, but the normal customer should not need to understand SKYT, PDAs, program accounts, or transaction construction.

## First activation market

The first live Devnet market should be a single agricultural rainfall index:

**Des Moines crop belt, Des Moines, Iowa, United States**

Use this as the tracer market before activating the remaining catalog. The other eleven agricultural indexes stay in the research catalog until their NOAA evidence packages are independently validated and pinned.

The active catalog remains:

| Catalog group | Reference location | Customer label |
| --- | --- | --- |
| North America | Des Moines, Iowa, United States | Des Moines crop belt |
| North America | Fresno, California, United States | Fresno Valley crops |
| North America | Lubbock, Texas, United States | Lubbock cotton plains |
| North America | Winnipeg, Manitoba, Canada | Winnipeg prairie grains |
| South America | Cordoba, Cordoba Province, Argentina | Cordoba grain belt |
| South America | Sorriso, Mato Grosso, Brazil | Sorriso soy frontier |
| South America | Asuncion, Capital District, Paraguay | Asuncion crop corridor |
| South America | Santa Cruz, Santa Cruz Department, Bolivia | Santa Cruz lowlands |
| Emerging markets | Ludhiana, Punjab, India | Ludhiana wheat-rice belt |
| Emerging markets | Nagpur, Maharashtra, India | Nagpur cotton-orange belt |
| Emerging markets | Eldoret, Uasin Gishu County, Kenya | Eldoret maize highlands |
| Emerging markets | Arusha, Arusha Region, Tanzania | Arusha horticulture belt |

## Customer journey

1. The buyer searches by place, state/province, country, crop, or catalog region.
2. SkyHedge shows only researched agricultural indexes, with exact location labels and evidence status.
3. The buyer opens an index and sees the reference location, crop context, rainfall metric, basis-risk note, and map context.
4. The buyer enters a USD protection amount, rainfall threshold in millimetres, risk direction, and observation dates.
5. The advisory layer explains whether the request fits an available index and why.
6. The quote layer shows a non-binding preview premium until USDC collateral and checkout are live.
7. When production payments exist, the buyer can pay by bank/card/embedded wallet, while crypto-native users may choose a wallet path.
8. After the observation window, NOAA final data resolves the market as winning, losing, or `DATA_UNAVAILABLE`.
9. The buyer claims a payout or refund from a guided customer flow. Builder mode can show the corresponding Solana transaction proof.

## Builder demo journey

The Solana ecosystem demo should be a guided live Devnet proof:

1. Connect Phantom or Solflare on Devnet.
2. Show program identity, SKYT mint, protocol PDA, fee vault, settlement authority, and upgrade authority.
3. Use a rate-limited test collateral dispenser for demo users. The dispenser should transfer pre-funded SKYT; it must not expose mint authority.
4. Open or inspect the Des Moines Devnet market only after protocol initialization and finalized market creation.
5. Let the reviewer fund liquidity or open a small protection position only when the deployed IDL and instruction are available.
6. Show Explorer links for every confirmed transaction.
7. Show one live open market plus one prior proof lifecycle only after a real lifecycle exists. Do not fabricate historical proof.

Recommended dispenser default:

```text
100 SKYT per wallet per 24 hours
10 wallet claims per IP per day
service wallet holds a limited pre-funded balance
admin wallet keeps mint authority
```

## Evidence and settlement

NOAA is the only V1 settlement source. WeatherXM can appear only as supplemental regional context and must be labeled:

```text
Context only - not used for settlement
```

Before an index becomes available, SkyHedge must pin:

- NOAA station ID
- station coverage status
- local observation window
- methodology hash
- source hash workflow
- claim deadline
- basis-risk disclosure

If NOAA cannot provide valid final data within the source deadline, the outcome is `DATA_UNAVAILABLE`. Buyers receive premium refunds, reserved exposure is released, and LP principal is preserved according to the protocol rules.

## Pricing model

The quote model stays fixed-payout and conservative:

```text
trigger_probability_bps =
  70% historical analogous-window probability
  + 30% forecast/QPF probability

premium_rate_bps =
  ceil(trigger_probability_bps * 1.15) + 100

premium =
  ceil(protected_amount * premium_rate_bps / 10,000)
```

The public UI should explain this as:

- estimated rainfall trigger probability
- 15% risk loading
- 1% protocol fee
- non-binding USD preview
- final checkout unavailable until USDC collateral is live

## Source of truth

For the current Devnet stage, finalized Solana RPC reads are the product source of truth. PostgreSQL remains deferred and should not be required for public Devnet correctness.

The system still needs an always-on API/worker for NOAA fetching, quote evidence, settlement submissions, dispenser limits, and transaction preparation. A static frontend alone cannot perform that role.

## Current honest state

As of this document, the expected state is:

- Public website exists.
- Agricultural catalog UI exists.
- Des Moines should be treated as the first activation target.
- SKYT is Devnet-only test collateral.
- Public customer checkout is disabled until USDC collateral exists.
- Protocol initialization, market seeding, dispenser funding, NOAA validation, and first-market lifecycle proof are the remaining activation gates.

Do not claim SkyHedge is a live protection protocol until the Devnet program, protocol PDA, first market, evidence workflow, wallet transactions, and settlement path have all been verified on chain.

## Next build order

1. Make the docs, README, API health, and UI agree on the Des Moines-first agricultural V1.
2. Validate and pin the NOAA evidence package for Des Moines.
3. Initialize the Devnet protocol with the admin wallet and existing SKYT mint.
4. Seed one Des Moines market with real finalized RPC visibility.
5. Add the rate-limited SKYT dispenser for builder demos.
6. Wire customer mode to USD previews and builder mode to Devnet actions.
7. Run the first live lifecycle end to end.
8. Create a Solana grant/funding demo package from real Explorer links and evidence artifacts.
