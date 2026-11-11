# Mid-December Devnet rain markets

NOAA GHCND daily precipitation, summed over December 14–16, 2026 inclusive in each station’s timezone; thresholds are inclusive. Each market is seeded with 400 mUSDC by the existing creator, who will manually resolve later using complete, unflagged NOAA records. Station-local days do not guarantee midnight-to-midnight measurements. Existing December 8–9 markets and the historical demo remain unchanged.

Station IDs and exact names were verified against the [GHCN station list](https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt), retrieved November 10, 2026. [Saved station records and source SHA-256](stations.2026-11-10.json).

| City | Station / NOAA name | Rain threshold | Inclusive window | Trading close (America/Chicago) | Trading close (UTC) | Market / Explorer |
| --- | --- | --- | --- | --- | --- | --- |
| Seattle | USW00024233 / SEATTLE TACOMA AP | ≥ 5 mm (50 tenths) | 2026-12-14–2026-12-16 | Dec 14, 2026, 1:59:59 AM CST | 2026-12-14T07:59:59.000Z | [ECYUcvTjDX3AsMr7UBgXDBPyekRLdb2hMpZ9VP995uEW](https://explorer.solana.com/address/ECYUcvTjDX3AsMr7UBgXDBPyekRLdb2hMpZ9VP995uEW?cluster=devnet) |
| Miami | USW00012839 / MIAMI INTL AP | ≥ 10 mm (100 tenths) | 2026-12-14–2026-12-16 | Dec 13, 2026, 10:59:59 PM CST | 2026-12-14T04:59:59.000Z | [DWo9mtQHRRKhWvhPv9Z5ExDHbBcWHbaCHynN9oXKnxeF](https://explorer.solana.com/address/DWo9mtQHRRKhWvhPv9Z5ExDHbBcWHbaCHynN9oXKnxeF?cluster=devnet) |
| New York | USW00094728 / NY CITY CNTRL PARK | ≥ 25 mm (250 tenths) | 2026-12-14–2026-12-16 | Dec 13, 2026, 10:59:59 PM CST | 2026-12-14T04:59:59.000Z | [isZb8kZ7LCrXj5sLgZwhGLFN3iSDrxD81xrTHp7ZnNs](https://explorer.solana.com/address/isZb8kZ7LCrXj5sLgZwhGLFN3iSDrxD81xrTHp7ZnNs?cluster=devnet) |
| Chicago | USW00094846 / CHICAGO OHARE INTL AP | ≥ 5 mm (50 tenths) | 2026-12-14–2026-12-16 | Dec 13, 2026, 11:59:59 PM CST | 2026-12-14T05:59:59.000Z | [FjESYK8x4w8B3TE75ojEFv5Rmhme2RXsF8WsHew3pZFj](https://explorer.solana.com/address/FjESYK8x4w8B3TE75ojEFv5Rmhme2RXsF8WsHew3pZFj?cluster=devnet) |
| Seattle | USW00024233 / SEATTLE TACOMA AP | ≥ 25 mm (250 tenths) | 2026-12-14–2026-12-16 | Dec 14, 2026, 1:59:59 AM CST | 2026-12-14T07:59:59.000Z | [27T56fUXH7eNmsHog78B4aTmjufYxyPWRfmuczQHa2E3](https://explorer.solana.com/address/27T56fUXH7eNmsHog78B4aTmjufYxyPWRfmuczQHa2E3?cluster=devnet) |

The close is exactly one second before December 14 midnight in each station’s timezone. NOAA resolution waits until all three daily observations are available; no alternative station or automatic missing-data outcome is used.

## Funding and stop

Measured before funding: creator 189.720997 mUSDC / 0.05842636 SOL; script trader 1005.179001 mUSDC / 0.19699812 SOL. One Devnet CLI airdrop request for 1 SOL was refused (possible rate limit); it was not retried. One official creator faucet request succeeded with 1000 mUSDC and 0 SOL. Transferred 1000 existing mUSDC and 0.13 SOL from script trader to creator. Funding and creation signatures and Explorer links are in [run log](run.devnet.json), along with persisted attempts and finalized receipts. No extra wallet was created or used for funding.

After five creations, measured at 2026-11-10T20:00:40.058Z: creator 189.720997 mUSDC / 0.01151556 SOL; script trader 5.179001 mUSDC / 0.06699312 SOL. Total remaining mUSDC is 194.899998. Stopped before a sixth send; no failed/uncertain creation sends and no endTs drift occurred. Seven strikes were planned; Miami 25 mm and Seattle 10 mm remain uncreated.

| Target new markets | Additional markets | Additional creator mUSDC needed (script trader retained) | Additional creator SOL needed (estimate) |
| --- | --- | --- | --- |
| 6 | 1 | 210.279003 | 0.02448444 |
| 7 (planned batch) | 2 | 610.279003 | 0.06048444 |
| 8 | 3 | 1010.279003 | 0.09648444 |

SOL estimates use a conservative 0.036 SOL per further creation, compared with the observed 0.03538216 SOL for each of these five creations. Rent/fees can change. Existing script-trader SOL could support another transfer if more mUSDC becomes available, but no unnecessary transfer was made. If every remaining script-trader mUSDC were moved, the six-market mUSDC shortfall would be 205.100002; retaining its 5.179001 mUSDC leaves it usable for a typical 5 mUSDC script trade. No hours-long faucet wait or lower seed was used.

## Creation and recovery

Run `node --import tsx scripts/pm-amm/create.ts --mid-december` for a dry run; `--send` is the explicit send switch. Already cataloged station/window/threshold/demo combinations are skipped. Different thresholds coexist. The script uses SDK 0.2.0 instruction builders with an absolute endTs, rather than the SDK send wrapper’s wall-clock duration conversion. Initialization and seed deposit share one transaction; market ID/PDA/spec are persisted before broadcast. Never retry ambiguous attempts; inspect the recorded PDA and signature first. Legacy attempt markers are preserved. Only one operator process may run at a time.

Seattle and Miami remain cataloged and on-chain but are flagged `hidden` and omitted from the default `/app` markets list. The mid-December New York 25 mm and Chicago 5 mm markets stay visible.
