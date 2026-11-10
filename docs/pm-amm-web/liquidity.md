# Liquidity measurement

Computed offline with the official quoteSwap helper, SDK 0.2.0, symmetric seed at 50% and at initial creation time. Formula: both reserves = seed; L_eff = seed / phi(0). NO buys are symmetric. Values are calculations, not executed receipts. Regenerate with node --import tsx scripts/pm-amm/liquidity.ts.

| Seed mUSDC | Input mUSDC | YES shares quoted | YES price change (percentage points) |
| --- | --- | --- | --- |
| 50 | 5 | 9.512128 | 3.0249 |
| 50 | 10 | 18.511238 | 5.8710 |
| 50 | 25 | 43.135171 | 13.4640 |
| 100 | 5 | 9.651754 | 1.5358 |
| 100 | 10 | 19.024256 | 3.0249 |
| 100 | 25 | 45.687107 | 7.2313 |
| 250 | 5 | 9.739610 | 0.6200 |
| 250 | 10 | 19.361371 | 1.2324 |
| 250 | 25 | 47.560641 | 3.0249 |
| 400 | 5 | 9.762081 | 0.3884 |
| 400 | 10 | 19.449489 | 0.7738 |
| 400 | 25 | 48.080365 | 1.9123 |

Assumption: a typical demo trade is 10 mUSDC. Choose 400 mUSDC per upcoming market: two markets require 800 mUSDC, within the creator’s measured 994.810785 mUSDC after the spike. The table shows the initial price movement. Liquidity decays with time; this is not a promise of the same impact near expiry or after other trades. The historical mechanics demo uses 50 mUSDC to conserve funds.
