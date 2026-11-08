# x402 quote demo (about 1:45)

Encode “Best Use of x402 on Solana”. Devnet only. The access payment is Devnet USDC. The quote it unlocks is still a SKYT rainfall price from the same NOAA path as the app. Do not say a regulated-product noun. Do not read a premium off this page: read the terminal.

Production is live on skyhedge.app and returns a payable HTTP 402 for a valid unpaid window. Filming uses the production URL. Detailed Miro-only preparation and recording commands are in the [recording checklist](submission/x402-recording-checklist.md). This is a filming plan; no paid-call clip is claimed here.

## On screen

1. `/developers` — request, 402, paid response.
2. Terminal: a real `402` with `scheme: exact`, Solana Devnet, Devnet USDC, the receiving address, and the facilitator fee payer.
3. The agent pays, the quote prints, and the Explorer link is Devnet.
4. The same request with a 1-base-unit payment prints `WRONG_AMOUNT` and no premium.

## Voiceover

“SkyHedge prices rainfall protection from NOAA. This endpoint sells that quote to an agent. No account. HTTP 402, then Devnet USDC, then the quote.

Here is the unpaid call. Exact scheme, Solana Devnet, Devnet USDC. The fee payer is the facilitator, so the server never holds a key. The body is the payment requirement, not the quote.

The agent loads a local Devnet key, signs the transfer, and retries. That is the quote: city, window, trigger, premium, payout, multiple, probability, fee, and the NOAA station and inputs hash behind it. The Explorer link is the USDC payment. The premium is still test SKYT.

Send the wrong amount and it stays a 402. If Devnet is late confirming, the script waits on that same signature instead of paying again. No quote until that payment finalizes.”

## Shot list

| Time | On screen | Do | Say |
| --- | --- | --- | --- |
| 0:00–0:12 | `/developers` | Hold on the title and the request. | First two sentences. |
| 0:12–0:38 | Terminal, dry run | Run the dry-run command. Pause on `402`, `exact`, the Devnet network, and `feePayer`. | The unpaid-call paragraph. |
| 0:38–1:12 | Terminal, paid run | Run without `--dry-run`. Pause on premium, payout, evidence, then the Explorer URL. If the terminal shows `SETTLEMENT_PENDING`, leave it: the script re-sends that signature and does not start a second payment. | The agent paragraph. Read the figures from the terminal. |
| 1:12–1:32 | Terminal, bad payment | Run `--bad-payment`. Pause on `WRONG_AMOUNT`. | The refusal paragraph. |
| 1:32–1:45 | `/developers`, “When it refuses” | Hold. | Stop. Do not invent a second price. |

## Commands

Use the production commands in the [recording checklist](submission/x402-recording-checklist.md), in order: dry-run, paid call, then bad-payment refusal. The script defaults to `https://skyhedge.app/api/x402/quote`. Use an open market's exact window and read the resulting premium from the terminal.

## Env vars

Existing server configuration reference only; production is already configured. Public values only. No setup or deployment is needed for filming.

| Variable | Required | Purpose |
| --- | --- | --- |
| `X402_PAY_TO` | Yes | Devnet wallet that receives USDC. Public address only. |
| `X402_QUOTE_PRICE_USDC` | No | Access price. Default `0.01`. At most `1`. |
| `X402_FACILITATOR_URL` | No | Default `https://x402.org/facilitator`. |
| `SOLANA_NETWORK` | Yes | Must be `devnet`. |
| `SOLANA_RPC_URL` | No | Devnet RPC used to confirm a submitted signature. In production this is Helius. Public Devnet is the fallback. A 429 here does not become a new charge. |
| `NOAA_TOKEN` | For a live quote | Already used by `/api/quotes`. A matching open market can be priced from committed terms without a fresh NOAA read. |

Agent machine only. Never put these on Vercel.

| Variable | Purpose |
| --- | --- |
| `X402_AGENT_KEYPAIR` | Path to a Solana CLI keypair JSON file. `.local-secrets/` is gitignored. |
| `X402_QUOTE_URL` | Optional. Default `https://skyhedge.app/api/x402/quote`. Use production for filming. |
| `SOLANA_RPC_URL` | Optional Devnet RPC for the agent’s own signature check. Default public Devnet. |
| `X402_PENDING_PATH` | Optional. Default `.local-secrets/x402-pending-quote.json`. The script writes the last payment here so a re-run reuses it. Gitignored. Not a key. |

## Recording preparation (Miro)

Follow the [recording checklist](submission/x402-recording-checklist.md) for the throwaway Devnet agent wallet, funding, recipient token-account check, and filming. Only Miro creates/funds the wallet and signs the paid call. Keep the public description's x402 paragraph commented until a real paid-call clip and Explorer link exist.
