# Missing NOAA data

These are ordinary binary pm-AMM markets, SDK 0.2.0. The [published instruction reference](https://predict-pm-amm.dev/llms.txt), retrieved November 10, 2026, lists manual creator resolution and winning-token redemption, but no binary-market void, cancel or refund instruction. Group cancellation and commitment/bet-vault refunds apply to different account types; they cannot refund these markets.

The resolver refuses missing days, duplicate days, malformed precipitation and nonblank NOAA quality flags. It does not treat missing rain as zero. The operator waits for NOAA to publish usable data and runs a dry evaluation again before sending. There is no automatic waiting deadline that changes the outcome. No fallback station is authorized: changing the station after trades would change the agreed strike.

Users may have to wait indefinitely if the named station never supplies acceptable records. Trading ends at the published time; selling is then unavailable. There is no guaranteed refund, independent dispute process or alternative payout. Do not resolve NO just because data is absent. The operator must communicate an outage and keep evidence of the missing/flagged response outside the settlement evidence record. A future product needs a program-supported no-data settlement design before real funds are considered.

A historical mechanics demo has known weather and does not demonstrate forecasting or fair pricing. It is explicitly marked in the catalog and UI.
