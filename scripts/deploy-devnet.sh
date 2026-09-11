#!/usr/bin/env bash
# Deploy the SkyHedge program to Devnet.
# Requires: deployer wallet ~/.config/solana/id.json with >= 3.4 SOL (program ~3.34 SOL rent).
# The deploy keypair (anchor/target/deploy/skyhedge_protection-keypair.json) is the immutable
# program authority and MUST match declare_id! — it does (5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== Building (known-good recipe) =="
npm run solana:build

echo "== Balance check =="
BALANCE=$(solana balance --url https://api.devnet.solana.com | awk '{print $1}')
echo "deployer balance: ${BALANCE} SOL"
if awk "BEGIN { exit !(${BALANCE} < 3.4) }"; then
  echo "BLOCKED: deploy needs ~3.34 SOL for program rent. Try:"
  echo "  npm run skyt:airdrop -- 2 12 3.4   # retry loop"
  echo "  or https://faucet.solana.com / https://solfaucet.com"
  exit 1
fi

echo "== Deploying to Devnet =="
(cd anchor && anchor deploy --provider.cluster devnet)

echo "== Verifying on-chain =="
npm run usdc:status
