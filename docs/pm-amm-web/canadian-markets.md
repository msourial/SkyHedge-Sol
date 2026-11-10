# Canadian mid-December Devnet markets

Environment Canada daily climate totals (rain plus melted snow) for Toronto Intl A (`6158731`) and Montreal Intl A (`7025251`), summed over December 14–16, 2026 inclusive. Trading closes at 10:59:59 PM CST on December 13, 2026 (`endTs` 1797224399). Each created market is seeded with 400 mUSDC. See [Environment Canada settlement](eccc.md).

Creation order when funds are partial: Toronto 10 mm, Montreal 10 mm, then both 5 mm strikes, then both 25 mm strikes. Pools are not shrunk below 400 mUSDC.

## Created

| City | Threshold | Market | Creation transaction |
| --- | --- | --- | --- |
| Toronto | ≥ 10 mm | [6VhJRjXtLVwPL5L2zMbsSPTsbvzYzekfcHNEdZgsNWA2](https://explorer.solana.com/address/6VhJRjXtLVwPL5L2zMbsSPTsbvzYzekfcHNEdZgsNWA2?cluster=devnet) | [5ko9akXh4gmZzXUbMF87krpdA3T3MRZUX9pcePaof9pvwkyT3qEqjX34LwzyCfNADWEqyeYRPGv8mL9mfAQia97v](https://explorer.solana.com/tx/5ko9akXh4gmZzXUbMF87krpdA3T3MRZUX9pcePaof9pvwkyT3qEqjX34LwzyCfNADWEqyeYRPGv8mL9mfAQia97v?cluster=devnet) |
| Montreal | ≥ 10 mm | [HMN86GTepwSTUdLfKTUvk93V9hpph562EXHeoo6vPYqu](https://explorer.solana.com/address/HMN86GTepwSTUdLfKTUvk93V9hpph562EXHeoo6vPYqu?cluster=devnet) | [2gm2NVAK1sjfbM191Qj1xwtjbXwJHuwpKpvKzz2GpGG39TFxccetQc91RLqD24GgrkM3Ux2yRoahcjNjH81dAF42](https://explorer.solana.com/tx/2gm2NVAK1sjfbM191Qj1xwtjbXwJHuwpKpvKzz2GpGG39TFxccetQc91RLqD24GgrkM3Ux2yRoahcjNjH81dAF42?cluster=devnet) |
| Toronto | ≥ 5 mm | [4WyAAMzRd1JttRPRg3B3ANA3eBitHrQ7GLBecLfTRZZ2](https://explorer.solana.com/address/4WyAAMzRd1JttRPRg3B3ANA3eBitHrQ7GLBecLfTRZZ2?cluster=devnet) | [65Ec4mhSBTTR9AFhs92oZX9zW74cwEpQYbeJRhEAzkrKGRdcGSXS9up6tg2sjFbMaqCSFSLHTMsa6TjHbLQAUGTc](https://explorer.solana.com/tx/65Ec4mhSBTTR9AFhs92oZX9zW74cwEpQYbeJRhEAzkrKGRdcGSXS9up6tg2sjFbMaqCSFSLHTMsa6TjHbLQAUGTc?cluster=devnet) |
| Montreal | ≥ 5 mm | [6K2UfcZgq939GAx38ipW32CHMnxgrUMU8LC1j9bTM9GB](https://explorer.solana.com/address/6K2UfcZgq939GAx38ipW32CHMnxgrUMU8LC1j9bTM9GB?cluster=devnet) | [32AruH5rRqGx9ojw9UrysuRS4JhEaVBWMhYG2DidyAhrzKjJWWNDBzSQymEsK3YEwZ7sQh4QUoRMYnEH1FS2JWmZ](https://explorer.solana.com/tx/32AruH5rRqGx9ojw9UrysuRS4JhEaVBWMhYG2DidyAhrzKjJWWNDBzSQymEsK3YEwZ7sQh4QUoRMYnEH1FS2JWmZ?cluster=devnet) |
| Toronto | ≥ 25 mm | [8tP3cu181Sn8kkTEXhv4jkXMqYkhnrTGaqHVX4rqzyY7](https://explorer.solana.com/address/8tP3cu181Sn8kkTEXhv4jkXMqYkhnrTGaqHVX4rqzyY7?cluster=devnet) | [4PVxhXmVwfZb4QKdyuDRGEjzXyN13QguQcWh1NrjyKnSwgzBH93dHj3fZYzQjXCW7gET3riYpze9iu14Ge9rX3Yt](https://explorer.solana.com/tx/4PVxhXmVwfZb4QKdyuDRGEjzXyN13QguQcWh1NrjyKnSwgzBH93dHj3fZYzQjXCW7gET3riYpze9iu14Ge9rX3Yt?cluster=devnet) |

Montreal 25 mm remains uncreated. Seeds were kept at 400 mUSDC.

## Funding, measured 2026-11-10

Public Devnet airdrops of 0.1 and 0.25 SOL on `api.devnet.solana.com` were rate-limited. Ankr and Helius Devnet endpoints required an API key or login and were not used. `faucet.solana.com/api/v1/airdrop` returned HTTP 404. There is no PREDICT builder mint path in the official docs; mUSDC came from the official faucet at `https://pm-amm-devnet.vercel.app/api/faucet`.

- Script-trader official faucet at 2:16 PM CST (HTTP 200, 1000 mUSDC + 0.2 SOL): [3XUFxcZrYNikyp8D8g55emFgNBfjpemX94DRfzwENBVhSY4dLeavjs86HwDys1VfvBctFXetwryPwm88hewefdMq](https://explorer.solana.com/tx/3XUFxcZrYNikyp8D8g55emFgNBfjpemX94DRfzwENBVhSY4dLeavjs86HwDys1VfvBctFXetwryPwm88hewefdMq?cluster=devnet)
- Transfer of 1000 mUSDC and 0.24699312 spare SOL to the creator, leaving the script trader 0.019995 SOL and 5.179001 mUSDC: [4AGMVYfKQk4TcmxQHh8iXu9r3Uz4GXxRsxJKAnmpvkMy5yVTcEX4sQcfW3u16CH1dSoRFJqhF2NNvvWLio1uiuvD](https://explorer.solana.com/tx/4AGMVYfKQk4TcmxQHh8iXu9r3Uz4GXxRsxJKAnmpvkMy5yVTcEX4sQcfW3u16CH1dSoRFJqhF2NNvvWLio1uiuvD?cluster=devnet)
- Creator official faucet at 3:00:30 PM CST (HTTP 200, 1000 mUSDC + 0.2 SOL): [4Z1M5w9Q9J1L8cwibxXs32mywq1qMBtVQoK6fxnTVDWzK7C6khXBpdSHsA8Gent5tQWuah6RrnZg5tcw1vxXGcnE](https://explorer.solana.com/tx/4Z1M5w9Q9J1L8cwibxXs32mywq1qMBtVQoK6fxnTVDWzK7C6khXBpdSHsA8Gent5tQWuah6RrnZg5tcw1vxXGcnE?cluster=devnet)

The first faucet funded Toronto 10 mm and Montreal 10 mm. After the creator claim, measured balances were 1389.720997 mUSDC and 0.38774436 SOL, enough for three more 400 mUSDC seeds. Toronto 5 mm, Montreal 5 mm, and Toronto 25 mm were created, then the script stopped: insufficient funds for another 400 mUSDC seed. After those five creations, at 3:00:54 PM CST, the creator held 189.720997 mUSDC and 0.28159788 SOL. Montreal 25 mm stays uncreated until another official faucet claim can fund it without shrinking the seed.
