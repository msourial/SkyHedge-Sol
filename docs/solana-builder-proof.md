# SkyHedge — Solana Builder Proof

## One-line thesis

SkyHedge uses Solana to make parametric rainfall protection auditable: immutable market terms, USDC-ready collateral vaults, NOAA source-hashed settlement evidence, and deterministic payout or refund paths.

## Current state

- Anchor program and local-validator lifecycle tests are implemented.
- NOAA is the only V1 settlement source; WeatherXM is supplemental context only.
- Devnet program publication is the immediate technical gate. No public statement should imply that it is deployed until the executable account is verified.
- Twelve agricultural crop-belt locations are a research catalog, not live markets. Each requires an independently validated NOAA station before activation.

## Requested milestone support

Fund a reproducible Devnet proof: publish the program, initialize the protocol, validate and seed one NOAA-pinned agricultural market, run full liquidity/protection/settlement/refund paths, and produce Explorer-linked evidence plus security-review preparation.

## Consumer experience

The public product is USD-first. Bank, card, and embedded-wallet payment paths are planned; self-custody USDC is optional. SKYT is Devnet-only test collateral and is not presented as consumer money.

## Explicit non-claims

SkyHedge is not live insurance, a futures exchange, an options chain, or a public USDC custody product. Legal, payments, custody, KYC/AML, and launch-jurisdiction requirements precede any live rollout.
