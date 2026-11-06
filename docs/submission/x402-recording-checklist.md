# x402 paid-call recording checklist (Miro only)

Devnet only. Production is live; a paid-call clip still needs to be filmed. Miro performs the wallet and payment steps locally. Grok Bot / this agent does not create a keypair, print a secret, fund a wallet, or sign/pay.

## Before recording

- Check out this repo with `scripts/x402-agent-demo.ts` and install Node dependencies with `npm ci` from the repo root.
- Have Node and the Solana CLI (`solana-keygen`, `solana`) installed.
- Prepare screen recording of the terminal, with optional browser shots of [developers docs](https://skyhedge.app/developers) and Solana Explorer. Keep key creation off camera.

## 1. Create a throwaway Devnet agent wallet

Miro only, from the repo root. This block refuses to overwrite an existing file, suppresses the seed phrase, and prints only the public address. `.local-secrets/` is already gitignored. Do not add `--force`.

```sh
(
  set -eu
  mkdir -p .local-secrets
  if [ -e .local-secrets/x402-agent.json ] || [ -L .local-secrets/x402-agent.json ]; then
    echo 'Refusing to overwrite existing agent keypair.' >&2
    exit 1
  fi
  solana-keygen new --no-bip39-passphrase --silent --outfile .local-secrets/x402-agent.json >/dev/null
  solana-keygen pubkey .local-secrets/x402-agent.json
)
```

If the file already exists, stop and verify locally that it is the intended throwaway Devnet wallet before reusing it. Never display its contents.

## 2. Fund and check token accounts

1. Open [Circle's faucet](https://faucet.circle.com), choose **Solana Devnet**, and send Devnet USDC to the agent's public address. Each paid call costs **0.01 Devnet USDC**.
2. The x402.org facilitator pays the SOL transaction fee, so the agent needs no SOL for the transfer itself. An optional tiny Devnet SOL airdrop is only needed if an associated token account (ATA) must be created.
3. Confirm in Devnet Explorer that the production payTo wallet already has an ATA for Circle Devnet USDC. If a paid call fails because the recipient ATA is missing, send any small amount of Devnet USDC once to the payTo wallet to create it:
   - payTo: `6rm343sXtXgj3KoQ2RaD4YdvspMW1oS8TJPxf2amFdcw`
   - Mint: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

## 3. Choose the exact market window

Use an open market's exact window so pricing comes from committed on-chain terms. Recommended demo window (open as of Encode prep): **New York December rain ≥118 mm**, with `protectedAmount=100000000` (**100 SKYT**, six decimals). The monthly window below returned HTTP 402 on 6 November 2026. A Monday–Monday window from `2026-12-07` to `2026-12-14` also returned the same 402 terms. Check that the chosen market is still open before filming; a payable 402 alone does not demonstrate a successful paid quote.

## 4. Record these three commands in order

From the repo root, Miro runs the following against production. The script already defaults to this production URL; the explicit export makes the target clear.

```sh
export X402_AGENT_KEYPAIR="$PWD/.local-secrets/x402-agent.json"
export X402_QUOTE_URL='https://skyhedge.app/api/x402/quote'
ARGS='--city new-york --observation-start 2026-12-01 --observation-end 2027-01-01 --threshold-mm 118 --operator gte --protected-amount 100000000'
npx tsx scripts/x402-agent-demo.ts --dry-run $ARGS
npx tsx scripts/x402-agent-demo.ts $ARGS
npx tsx scripts/x402-agent-demo.ts --bad-payment $ARGS
```

Expected footage:

- **Dry-run:** HTTP 402 `PAYMENT_REQUIRED`, quote withheld; x402 V2 scheme `exact`, amount `10000` base units (**0.01 Devnet USDC**), network `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`. The response asks for the exact amount in a `PAYMENT-SIGNATURE` header.
- **Paid call:** Miro's local agent signs the payment; the terminal prints the quote and a Devnet Explorer link after settlement. Read the premium and other quote figures from the terminal; do not use a made-up number. If HTTP 202 `SETTLEMENT_PENDING` appears, leave it: the script retries the **same signature**, rather than paying twice.
- **Bad payment:** HTTP 402 `WRONG_AMOUNT`, no quote. Wrong network or asset is also refused with `WRONG_NETWORK` / `WRONG_ASSET`; those cases are already covered in `server/services/x402-quote.test.ts` and need no additional payment for this clip.

The advertised facilitator fee payer is `CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5`. SkyHedge's server holds no signing key.

## 5. Show the payment in Explorer

Open the paid call's printed Explorer URL, confirm **Devnet**, and show the **0.01 Devnet USDC** transfer to `6rm343sXtXgj3KoQ2RaD4YdvspMW1oS8TJPxf2amFdcw`. Keep the transaction URL for the submission evidence.

Optional browser shot: https://skyhedge.app/developers. Optional unpaid sanity check (no key, no payment), expecting HTTP 402:

```sh
curl -i 'https://skyhedge.app/api/x402/quote?city=new-york&observationStart=2026-12-01&observationEnd=2027-01-01&thresholdMm=118&operator=gte&protectedAmount=100000000'
```

## What not to do

- Do not commit `.local-secrets/` or any keypair.
- Do not paste the JSON, seed phrase, or private bytes into chat or show them in the video.
- Do not put the keypair on Vercel.
- Do not target mainnet or ask anyone else to sign.

## After recording

Share only the public agent address, Explorer URL of the paid transfer, and whether dry-run / paid / bad-payment matched these expectations. Then, and only after Miro has filmed the real paid call and has its Explorer link, the commented x402 paragraph in [description-final.md](description-final.md) can be uncommented for the public Encode description. This checklist does not establish that a clip exists.
