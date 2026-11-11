# Devnet test buy through the Seeker trading code path

Run Nov 10, 2026, 10:23 PM Central, from `mobile/` with `mobile/tools/pm-amm-devnet-buy.ts`.
The harness imports `mobile/src/pm-amm/transactions.ts` (`createBuyReview`, `submitPmAmmBuy`),
the same module the app calls; only the signer differs (local controlled keypair instead of MWA).

- Wallet: `DduTTfJeq6HZvua6bx5n2pMNcTjh7pr63V9uKDe37VC1` (script trader, listed in `shared/pm-amm/controlled-wallets.json`; excluded from stats and leaderboard)
- Market: `4WyAAMzRd1JttRPRg3B3ANA3eBitHrQ7GLBecLfTRZZ2` (Toronto, total precipitation ≥ 5 mm, Dec 14–16, Environment Canada)
- Side and amount: Yes, 1 mUSDC (fee 0.02 mUSDC)
- Quote: 1.958466 Yes shares, minimum 1.938881
- Received on chain: 1.958466 Yes shares; trader mUSDC 5.179001 → 4.179001
- Signature: `3eom27MViL9x1yD1RPNywKbBFri1g5pGzdUnqto3DW4qa4eq8imMpCU5b9zCF1pZQ9rEXw5PYzA4mTBtV8xK1aAR` (finalized, no error)
- Explorer: https://explorer.solana.com/tx/3eom27MViL9x1yD1RPNywKbBFri1g5pGzdUnqto3DW4qa4eq8imMpCU5b9zCF1pZQ9rEXw5PYzA4mTBtV8xK1aAR?cluster=devnet

Command (keypair path in an env var; the key is never printed):

```sh
SKYHEDGE_TRADER_KEYPAIR=<path> node --experimental-transform-types --import ./tools/resolve-shared-ts.mjs tools/pm-amm-devnet-buy.ts --market <address> --side yes --amount 1 [--send]
```
