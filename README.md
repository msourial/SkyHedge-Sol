# SkyHedge

SkyHedge is Devnet-only Solana software for fixed-payout cumulative-rainfall protection.

`Weather risk → protection contract → Solana → deterministic NOAA settlement → payout`

## V1 boundaries

- Markets: New York, Miami, and Chicago cumulative rainfall.
- Collateral: six-decimal `SKYT` Devnet SPL test token.
- Capacity per market: 10,000 SKYT liquidity, 8,000 SKYT exposure, 500 SKYT per wallet.
- Pricing: ten analogous NOAA windows plus a 30%-weighted NOAA forecast signal; expected payout, 15% risk loading, and a 1% protocol fee.
- Settlement: one NOAA source, one dedicated authority, source hash recorded on chain.
- If final NOAA data is unavailable after seven days, the market enters `DATA_UNAVAILABLE` and buyers can reclaim premiums.

SkyHedge is not an options exchange, futures market, staking product, multi-chain app, or automated trading system. AI is advisory-only and requires user approval before an unsigned transaction can be prepared.

## Commands

```sh
npm run solana:test
npm run build
```

Set `NOAA_TOKEN` for NOAA Climate Data Online historical observations. If the provider cannot return required data, the service returns `DATA_UNAVAILABLE`; it never creates fallback weather observations.

The Devnet program ID is `GSSmUiGYFT72aMh96dSaxYNQgAJL7Kqi18cZ6zaPuJSL`. Its local deployment keypair is intentionally excluded from version control.
