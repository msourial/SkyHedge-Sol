#!/usr/bin/env bash
# Deploy the SkyHedge program to Devnet.
# Upgrades the existing program only when the configured local signer matches the verified
# on-chain upgrade authority. The configured RPC URL is read from the environment or .env.
set -Eeuo pipefail
cd "$(dirname "$0")/.."

if [[ -z "${SOLANA_RPC_URL:-}" && -f .env ]]; then
  SOLANA_RPC_URL="$(node -e 'const fs=require("node:fs");const dotenv=require("dotenv");const parsed=dotenv.parse(fs.readFileSync(".env"));process.stdout.write(parsed.SOLANA_RPC_URL??"")')"
  export SOLANA_RPC_URL
fi

WRITE_RPC="${SOLANA_DEPLOY_RPC_URL:-https://api.devnet.solana.com}"
VERIFY_RPC="${SOLANA_RPC_URL:-$WRITE_RPC}"
WRITE_TRANSPORT_ARGS=(--use-tpu-client)
if [[ "${SOLANA_DEPLOY_USE_TPU:-true}" != "true" ]]; then WRITE_TRANSPORT_ARGS=(--use-rpc); fi
PROGRAM_ID="5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx"
PROGRAM_KEYPAIR="anchor/target/deploy/skyhedge_protection-keypair.json"
PROGRAM_SO="anchor/target/deploy/skyhedge_protection.so"
UPGRADE_AUTHORITY_KEYPAIR="${SOLANA_UPGRADE_AUTHORITY_KEYPAIR:-${HOME}/.config/solana/id.json}"
BUFFER_KEYPAIR="${SOLANA_DEPLOY_BUFFER_KEYPAIR:-anchor/keys/devnet-deployment-buffer-v2.json}"

fail() { echo "DEPLOYMENT FAILED: $*" >&2; exit 1; }
trap 'fail "line $LINENO (exit $?)"' ERR

echo "== Building (known-good recipe) =="
npm run solana:build

echo "== Balance check =="
test -f "$PROGRAM_KEYPAIR" || fail "program keypair is missing: $PROGRAM_KEYPAIR"
test -f "$PROGRAM_SO" || fail "compiled program is missing: $PROGRAM_SO"
test -f "$UPGRADE_AUTHORITY_KEYPAIR" || fail "upgrade-authority keypair is missing: $UPGRADE_AUTHORITY_KEYPAIR"
PROGRAM_BYTES=$(stat -f '%z' "$PROGRAM_SO")
BUFFER_ACCOUNT_BYTES=$((PROGRAM_BYTES + 41))
ACTUAL_ID=$(solana address -k "$PROGRAM_KEYPAIR")
test "$ACTUAL_ID" = "$PROGRAM_ID" || fail "keypair is $ACTUAL_ID, expected $PROGRAM_ID"
UPGRADE_AUTHORITY=$(solana address -k "$UPGRADE_AUTHORITY_KEYPAIR")

echo "== Existing program check =="
EXISTING_PROGRAM=false
if solana program show "$PROGRAM_ID" --url "$VERIFY_RPC" --output json >/tmp/skyhedge-program-before.json 2>/tmp/skyhedge-program-error.log; then
  EXISTING_PROGRAM=true
  jq -e --arg id "$PROGRAM_ID" '.programId == $id and .owner == "BPFLoaderUpgradeab1e11111111111111111111111" and (.authority | type == "string")' /tmp/skyhedge-program-before.json >/dev/null || fail "existing program metadata is malformed or not upgradeable"
  CURRENT_AUTHORITY=$(jq -r '.authority' /tmp/skyhedge-program-before.json)
  test "$CURRENT_AUTHORITY" = "$UPGRADE_AUTHORITY" || fail "configured signer does not match the verified on-chain upgrade authority"
  echo "Existing program is upgradeable; local signer matches its authority."
  IDL_AUTHORITY=$(cd anchor && anchor idl authority --provider.cluster devnet "$PROGRAM_ID") || fail "could not verify deployed IDL authority"
  test "$IDL_AUTHORITY" = "$UPGRADE_AUTHORITY" || fail "configured signer does not match the deployed IDL authority"
else
  if ! rg -qi 'AccountNotFound|account not found|not found' /tmp/skyhedge-program-error.log; then
    fail "could not verify whether the Devnet program exists; see /tmp/skyhedge-program-error.log"
  fi
  echo "No existing program account found; preparing initial publication."
fi

echo "== Buffer validation =="
if test -f "$BUFFER_KEYPAIR"; then
  BUFFER_ADDRESS=$(solana address -k "$BUFFER_KEYPAIR")
  echo "Using deployment buffer signer: $BUFFER_ADDRESS"
else
  mkdir -p "$(dirname "$BUFFER_KEYPAIR")"
  solana-keygen new --no-bip39-passphrase --silent --outfile "$BUFFER_KEYPAIR" >/dev/null
  BUFFER_ADDRESS=$(solana address -k "$BUFFER_KEYPAIR")
  echo "Created a local deployment buffer signer: $BUFFER_ADDRESS"
fi

verify_buffer_account() {
  local require_present="$1"
  local buffer_check
  buffer_check=$(
    SOLANA_DEPLOY_VERIFY_RPC="$VERIFY_RPC" \
    SOLANA_DEPLOY_BUFFER_ADDRESS="$BUFFER_ADDRESS" \
    SOLANA_DEPLOY_UPGRADE_AUTHORITY="$UPGRADE_AUTHORITY" \
    SOLANA_DEPLOY_REQUIRED_BUFFER_BYTES="$((PROGRAM_BYTES + 37))" \
    SOLANA_DEPLOY_REQUIRE_BUFFER_PRESENT="$require_present" \
    node --input-type=module <<'NODE'
import { Connection, PublicKey } from "@solana/web3.js";
import { validateDeploymentBufferAccount } from "./scripts/deployment-buffer.mjs";

let connection;
try {
  connection = new Connection(process.env.SOLANA_DEPLOY_VERIFY_RPC, "finalized");
} catch {
  console.error("Could not initialize the finalized Devnet buffer verifier.");
  process.exit(1);
}

let account;
try {
  account = await connection.getAccountInfo(new PublicKey(process.env.SOLANA_DEPLOY_BUFFER_ADDRESS), "finalized");
} catch {
  console.error("Could not read the deployment buffer from finalized Devnet RPC.");
  process.exit(1);
}

let result;
try {
  result = validateDeploymentBufferAccount({
    account: account && { owner: account.owner.toBase58(), executable: account.executable, data: account.data },
    loader: "BPFLoaderUpgradeab1e11111111111111111111111",
    authority: process.env.SOLANA_DEPLOY_UPGRADE_AUTHORITY,
    requiredDataLength: Number(process.env.SOLANA_DEPLOY_REQUIRED_BUFFER_BYTES),
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : "Deployment buffer validation failed.");
  process.exit(1);
}

if (result.status === "absent") {
  if (process.env.SOLANA_DEPLOY_REQUIRE_BUFFER_PRESENT === "true") {
    console.error("The deployment buffer was not finalized after upload.");
    process.exit(1);
  }
  console.log("Buffer address is unused on Devnet; the CLI may initialize it.");
  console.log("BUFFER_STATUS=absent");
} else {
  let rentExemptMinimum;
  try {
    rentExemptMinimum = await connection.getMinimumBalanceForRentExemption(result.dataLength);
  } catch {
    console.error("Could not verify the deployment buffer's rent exemption.");
    process.exit(1);
  }
  if (account.lamports < rentExemptMinimum) {
    console.error("Existing deployment buffer is not rent-exempt; refusing to overwrite it.");
    process.exit(1);
  }
  console.log(`Reusable finalized buffer verified (${result.dataLength} bytes; expected authority matches).`);
  console.log("BUFFER_STATUS=ready");
}
NODE
  ) || fail "deployment buffer validation failed"
  echo "$buffer_check"
}

BUFFER_STATUS_OUTPUT=$(verify_buffer_account false)
echo "$BUFFER_STATUS_OUTPUT" | sed '/^BUFFER_STATUS=/d'
BUFFER_STATUS=$(echo "$BUFFER_STATUS_OUTPUT" | sed -n 's/^BUFFER_STATUS=//p' | tail -n 1)
test "$BUFFER_STATUS" = "absent" || test "$BUFFER_STATUS" = "ready" || fail "could not determine deployment buffer funding state"

BALANCE=$(solana balance --url "$VERIFY_RPC" --keypair "$UPGRADE_AUTHORITY_KEYPAIR" | awk '{print $1}')
BUFFER_RENT=$(solana rent "$BUFFER_ACCOUNT_BYTES" --url "$VERIFY_RPC" | awk '/Rent-exempt minimum:/ {print $3}')
test -n "$BUFFER_RENT" || fail "could not calculate the deployment buffer's rent-exempt minimum"
MINIMUM_BALANCE=$(node --input-type=module -e 'import { minimumDeploymentBalance } from "./scripts/deployment-budget.mjs"; console.log(minimumDeploymentBalance({ bufferRentSol: process.argv[1], reserveSol: "0.05", reusableBuffer: process.argv[2] === "ready" }))' "$BUFFER_RENT" "$BUFFER_STATUS")
SHORTFALL=$(awk -v balance="$BALANCE" -v minimum="$MINIMUM_BALANCE" 'BEGIN {missing = minimum - balance; if (missing < 0) missing = 0; printf "%.9f", missing}')
echo "upgrade-authority balance: ${BALANCE} SOL; buffer rent: ${BUFFER_RENT} SOL; required now: ${MINIMUM_BALANCE} SOL (${BUFFER_STATUS} buffer)"
if ! awk -v balance="$BALANCE" -v minimum="$MINIMUM_BALANCE" 'BEGIN {exit !(balance >= minimum)}'; then
  fail "insufficient Devnet SOL for the remaining deployment steps; required total is ${MINIMUM_BALANCE} SOL and current balance is ${BALANCE} SOL, so add at least ${SHORTFALL} SOL more to the upgrade authority, then retry"
fi

echo "== Publishing to Devnet =="
echo "Writing program bytes to the reusable buffer (resumable upload)"
solana program write-buffer "$PROGRAM_SO" --buffer "$BUFFER_KEYPAIR" --buffer-authority "$UPGRADE_AUTHORITY_KEYPAIR" --url "$WRITE_RPC" "${WRITE_TRANSPORT_ARGS[@]}" --max-sign-attempts 20 --commitment confirmed
verify_buffer_account true | sed '/^BUFFER_STATUS=/d'
DEPLOY_ARGS=(program deploy "$PROGRAM_SO" --url "$WRITE_RPC" "${WRITE_TRANSPORT_ARGS[@]}" --upgrade-authority "$UPGRADE_AUTHORITY_KEYPAIR" --max-sign-attempts 12 --commitment finalized --buffer "$BUFFER_KEYPAIR")
if [[ "$EXISTING_PROGRAM" == "true" ]]; then
  DEPLOY_ARGS+=(--program-id "$PROGRAM_ID")
else
  DEPLOY_ARGS+=(--program-id "$PROGRAM_KEYPAIR")
fi
solana "${DEPLOY_ARGS[@]}" 2>&1 | tee /tmp/skyhedge-deploy.log
rg -q 'Program Id:' /tmp/skyhedge-deploy.log || fail "the Solana CLI returned no publish signature or Program Id; see /tmp/skyhedge-deploy.log"

echo "== Verifying upgraded program and deployed IDL =="
solana program show "$PROGRAM_ID" --url "$VERIFY_RPC" --output json >/tmp/skyhedge-program-after.json
jq -e --arg id "$PROGRAM_ID" --arg authority "$UPGRADE_AUTHORITY" '.programId == $id and .owner == "BPFLoaderUpgradeab1e11111111111111111111111" and .authority == $authority' /tmp/skyhedge-program-after.json >/dev/null || fail "program address, loader, or upgrade authority did not verify after publication"
solana account "$PROGRAM_ID" --url "$VERIFY_RPC" --output json >/tmp/skyhedge-program-account.json
rg -q 'executable.*true' /tmp/skyhedge-program-account.json || fail "publish completed without an executable program account"

echo "== Publishing matching Anchor IDL =="
(cd anchor && anchor idl upgrade --provider.cluster devnet --provider.wallet "$UPGRADE_AUTHORITY_KEYPAIR" --filepath ../shared/idl/skyhedge_protection.json "$PROGRAM_ID")
(cd anchor && anchor idl fetch --provider.cluster devnet "$PROGRAM_ID") >/tmp/skyhedge-deployed-idl.json
jq -e --arg id "$PROGRAM_ID" '.address == $id and (.instructions | any(.name == "cancel_empty_draft_market"))' /tmp/skyhedge-deployed-idl.json >/dev/null || fail "deployed IDL does not match the program address or lacks empty-Draft cancellation"
jq -S . shared/idl/skyhedge_protection.json >/tmp/skyhedge-committed-idl-canonical.json
jq -S . /tmp/skyhedge-deployed-idl.json >/tmp/skyhedge-deployed-idl-canonical.json
cmp -s /tmp/skyhedge-committed-idl-canonical.json /tmp/skyhedge-deployed-idl-canonical.json || fail "deployed IDL does not exactly match the committed IDL"
echo "Program and matching IDL verified: https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
