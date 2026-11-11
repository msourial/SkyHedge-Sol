# Seeker pm-AMM

The native rain flow uses PREDICT on Solana Devnet through the existing mobile wallet connection. The Line tokens, fonts, peril tiles, review sheet, receipt and app tabs remain the presentation layer. Shared catalog identity checks bind each listed address to its creator, name, end time and collateral mint.

## Coordinator buy harness

From `mobile/`, with a public-key-approved trader keypair path already supplied through `SKYHEDGE_TRADER_KEYPAIR`:

```sh
node --experimental-transform-types --import ./tools/resolve-shared-ts.mjs tools/pm-amm-devnet-buy.ts --market <address> --side yes --amount 1
```

This prints the quote and does not send. The coordinator can append `--send` to sign and submit through the same mobile transaction module. The harness rejects a wallet absent from `shared/pm-amm/controlled-wallets.json` and rejects any RPC other than the configured Devnet endpoint. Do not paste key contents into commands, logs or reports. This implementation session does not run the harness with a keypair.

## Funding and settlement

Use the official PREDICT site at https://predict-pm-amm.dev for Devnet mUSDC funding, and https://faucet.solana.com/ for Devnet SOL. The repository's official burner kit identifies https://pm-amm-devnet.vercel.app/api/faucet as its funding API. Funding is subject to faucet limits; the native app does not automatically retry funding requests.

Each winning share pays 1 mUSDC. Open positions show estimated values; settled positions show winning payout from chain. Public evidence retains the station, daily observations, total, threshold, outcome, source response hash and resolution signature. Source links and resolver/missing-data limits come from shared copy.

## Verification

See `REVIEW.md` for the final command results, fresh-context review findings, fixes and limitations. Android export proves Metro/Hermes packaging; it does not replace a coordinator-run device approval and buy.

Pending sends block another attempt for the same wallet. Wallet's **Check transaction** clears a marker only after the known signature is finalized. If no signature was returned, the app cannot prove whether the send happened and keeps the block; investigate that attempt externally before recovery. The harness stores public pending metadata at `mobile/.pmamm-pending/<publicKey>.json` relative to the script location regardless of the caller’s working directory, using exclusive file creation to reject concurrent processes. Confirmed signatures are retained on confirmation errors so their final status can be checked.
