# x402 quote demo (about 1:45)

Encode “Best Use of x402 on Solana”. Devnet only. The access payment is Devnet USDC. The quote it unlocks is still a SKYT rainfall price from the same NOAA path as the app. Do not say a regulated-product noun. Do not read a premium off this page: read the terminal.

This branch does not deploy and does not change Vercel env. Until `X402_PAY_TO` is set, the endpoint returns `PAYMENT_NOT_CONFIGURED` and no quote.

## On screen

1. `/developers` — request, 402, paid response.
2. Terminal: a real `402` with `scheme: exact`, Solana Devnet, Devnet USDC, the receiving address, and the facilitator fee payer.
3. The agent pays, the quote prints, and the Explorer link is Devnet.
4. The same request with a 1-base-unit payment prints `WRONG_AMOUNT` and no premium.

## Voiceover

“SkyHedge prices rainfall protection from NOAA. This endpoint sells that quote to an agent. No account. HTTP 402, then Devnet USDC, then the quote.

Here is the unpaid call. Exact scheme, Solana Devnet, Devnet USDC. The fee payer is the facilitator, so the server never holds a key. The body is the payment requirement, not the quote.

The agent loads a local Devnet key, signs the transfer, and retries. That is the quote: city, window, trigger, premium, payout, multiple, probability, fee, and the NOAA station and inputs hash behind it. The Explorer link is the USDC payment. The premium is still test SKYT.

Send the wrong amount and it stays a 402. Wrong network, wrong asset, a replay, or a facilitator that is down do the same. No quote until a payment actually settles.”

## Shot list

| Time | On screen | Do | Say |
| --- | --- | --- | --- |
| 0:00–0:12 | `/developers` | Hold on the title and the request. | First two sentences. |
| 0:12–0:38 | Terminal, dry run | Run the dry-run command. Pause on `402`, `exact`, the Devnet network, and `feePayer`. | The unpaid-call paragraph. |
| 0:38–1:12 | Terminal, paid run | Run without `--dry-run`. Pause on premium, payout, evidence, then the Explorer URL. Open the Explorer link if it has landed. | The agent paragraph. Read the figures from the terminal. |
| 1:12–1:32 | Terminal, bad payment | Run `--bad-payment`. Pause on `WRONG_AMOUNT`. | The refusal paragraph. |
| 1:32–1:45 | `/developers`, “When it refuses” | Hold. | Stop. Do not invent a second price. |

## Commands

Local server, from the repo, after the env below is set:

```sh
npm run dev
```

```sh
export X402_QUOTE_URL='http://127.0.0.1:5000/api/x402/quote?city=CITY&observationStart=START&observationEnd=END&thresholdMm=THRESHOLD&operator=gte&protectedAmount=AMOUNT'
npx tsx scripts/x402-agent-demo.ts --dry-run --city CITY --observation-start START --observation-end END --threshold-mm THRESHOLD --operator gte --protected-amount AMOUNT
npx tsx scripts/x402-agent-demo.ts --city CITY --observation-start START --observation-end END --threshold-mm THRESHOLD --operator gte --protected-amount AMOUNT
npx tsx scripts/x402-agent-demo.ts --bad-payment --city CITY --observation-start START --observation-end END --threshold-mm THRESHOLD --operator gte --protected-amount AMOUNT
```

`START` and `END` are a Monday-to-Monday week or a calendar month, `YYYY-MM-DD` UTC. `AMOUNT` is SKYT base units (6 decimals), at most 500 SKYT. `THRESHOLD` is the millimetre trigger you want priced. The script will not fill these in.

## Env vars

Server (Vercel project `skyhedge`, or local `.env`). Public values only. No private key.

| Variable | Required | Purpose |
| --- | --- | --- |
| `X402_PAY_TO` | Yes | Devnet wallet that receives USDC. Public address only. |
| `X402_QUOTE_PRICE_USDC` | No | Access price. Default `0.01`. At most `1`. |
| `X402_FACILITATOR_URL` | No | Default `https://x402.org/facilitator`. |
| `SOLANA_NETWORK` | Yes | Must be `devnet`. |
| `NOAA_TOKEN` | For a live quote | Already used by `/api/quotes`. A matching open market can be priced from committed terms without a fresh NOAA read. |

Agent machine only. Never put these on Vercel.

| Variable | Purpose |
| --- | --- |
| `X402_AGENT_KEYPAIR` | Path to a Solana CLI keypair JSON file. `.local-secrets/` is gitignored. |
| `X402_QUOTE_URL` | Optional. Default `https://skyhedge.app/api/x402/quote`. Use localhost until this is deployed. |
| `SOLANA_RPC_URL` | Optional Devnet RPC for the agent. Default public Devnet. |

## One-time setup (Miro)

Do these yourself. This change does not fund a wallet, send a transaction, or write Vercel env.

1. Create a Devnet receiving wallet. Set `X402_PAY_TO` to its public address. Keep the secret off the server and out of git.
2. Devnet USDC mint: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`. Create that wallet’s USDC token account and send it any Devnet USDC once (Circle’s Devnet faucet, `https://faucet.circle.com`). The exact scheme transfers into the account. It does not create the account.
3. Agent wallet: `solana-keygen new -o .local-secrets/x402-agent.json`. Set `X402_AGENT_KEYPAIR` to that path. Fund it with Devnet USDC from the same faucet, at least the access price (default 0.01). The facilitator pays the Solana fee, so the agent does not need SOL for this transfer. The agent’s USDC token account has to exist and cover the price.
4. Deploy when you want `skyhedge.app` to serve it. Set `X402_PAY_TO` on the Vercel project yourself. Do not set a private key there.
