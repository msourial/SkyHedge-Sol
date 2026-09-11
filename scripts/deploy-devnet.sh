#!/usr/bin/env bash
# Deploy the SkyHedge program to Devnet.
# Uses the public Devnet endpoint for program writes.  Paid RPC endpoints are deliberately
# not used for uploads: several providers reject the loader's large write transactions.
# The deploy keypair (anchor/target/deploy/skyhedge_protection-keypair.json) is the immutable
# program authority and MUST match declare_id! — it does (5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx).
set -Eeuo pipefail
cd "$(dirname "$0")/.."

WRITE_RPC="${SOLANA_DEPLOY_RPC_URL:-https://api.devnet.solana.com}"
VERIFY_RPC="${SOLANA_RPC_URL:-$WRITE_RPC}"
WRITE_TRANSPORT_ARGS=(--use-tpu-client)
if [[ "${SOLANA_DEPLOY_USE_RPC:-false}" == "true" ]]; then WRITE_TRANSPORT_ARGS=(--use-rpc); fi
PROGRAM_ID="5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx"
PROGRAM_KEYPAIR="anchor/target/deploy/skyhedge_protection-keypair.json"
PROGRAM_SO="anchor/target/deploy/skyhedge_protection.so"
BUFFER_KEYPAIR="${SOLANA_DEPLOY_BUFFER_KEYPAIR:-anchor/keys/devnet-deployment-buffer-v2.json}"

fail() { echo "DEPLOYMENT FAILED: $*" >&2; exit 1; }
trap 'fail "line $LINENO (exit $?)"' ERR

echo "== Building (known-good recipe) =="
npm run solana:build

echo "== Balance check =="
BALANCE=$(solana balance --url "$WRITE_RPC" | awk '{print $1}')
echo "deployer balance: ${BALANCE} SOL"
test -f "$PROGRAM_KEYPAIR" || fail "program keypair is missing: $PROGRAM_KEYPAIR"
test -f "$PROGRAM_SO" || fail "compiled program is missing: $PROGRAM_SO"
ACTUAL_ID=$(solana address -k "$PROGRAM_KEYPAIR")
test "$ACTUAL_ID" = "$PROGRAM_ID" || fail "keypair is $ACTUAL_ID, expected $PROGRAM_ID"

echo "== Existing program check =="
if solana account "$PROGRAM_ID" --url "$VERIFY_RPC" --output json >/tmp/skyhedge-program.json 2>/dev/null && rg -q 'executable.*true' /tmp/skyhedge-program.json; then
  echo "Program is already executable; refusing to overwrite it."
  exit 0
fi

echo "== Buffer validation =="
if test -f "$BUFFER_KEYPAIR"; then
  BUFFER_ADDRESS=$(solana address -k "$BUFFER_KEYPAIR")
  if solana account "$BUFFER_ADDRESS" --url "$WRITE_RPC" --output json >/tmp/skyhedge-buffer.json 2>/dev/null; then
    rg -q 'BPFLoaderUpgradeab1e11111111111111111111111' /tmp/skyhedge-buffer.json || fail "buffer $BUFFER_ADDRESS is not owned by the upgradeable loader"
    echo "Using validated buffer: $BUFFER_ADDRESS"
  else
    echo "Buffer keypair is new; the write step will create it on Devnet."
  fi
else
  echo "No reusable buffer keypair found; the CLI will create one and report its address."
fi

echo "== Publishing to Devnet =="
DEPLOY_ARGS=(program deploy "$PROGRAM_SO" --program-id "$PROGRAM_KEYPAIR" --url "$WRITE_RPC" "${WRITE_TRANSPORT_ARGS[@]}" --max-sign-attempts 12)
if test -f "$BUFFER_KEYPAIR"; then
  echo "Writing program bytes to the reusable buffer (resumable upload)"
  solana program write-buffer "$PROGRAM_SO" --buffer "$BUFFER_KEYPAIR" --url "$WRITE_RPC" "${WRITE_TRANSPORT_ARGS[@]}" --max-sign-attempts 20 --commitment confirmed
  DEPLOY_ARGS+=(--buffer "$BUFFER_KEYPAIR")
fi
solana "${DEPLOY_ARGS[@]}" 2>&1 | tee /tmp/skyhedge-deploy.log
rg -q 'Program Id:' /tmp/skyhedge-deploy.log || fail "the Solana CLI returned no publish signature or Program Id; see /tmp/skyhedge-deploy.log"

echo "== Verifying executable account =="
solana account "$PROGRAM_ID" --url "$VERIFY_RPC" --output json >/tmp/skyhedge-program.json
rg -q 'executable.*true' /tmp/skyhedge-program.json || fail "publish completed without an executable program account"
echo "Program verified: https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
