import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { minimumDeploymentBalance } from "./deployment-budget.mjs";
import { validateDeploymentBufferAccount } from "./deployment-buffer.mjs";

const loader = "BPFLoaderUpgradeab1e11111111111111111111111";
const authority = "11111111111111111111111111111111";

function bufferAccount({ owner = loader, state = 1, authorityKey = authority, executable = false, space = 512 } = {}) {
  const data = Buffer.alloc(space);
  data.writeUInt32LE(state, 0);
  data[4] = 1;
  Buffer.alloc(32).copy(data, 5);
  // The System Program address is 32 zero bytes, so this is also a valid test signer.
  return { owner, executable, data };
}

test("accepts an absent deployment buffer so write-buffer can initialize it", () => {
  assert.deepEqual(validateDeploymentBufferAccount({ account: null, loader, authority, requiredDataLength: 128 }), { status: "absent" });
});

test("accepts only an upgradeable-loader buffer controlled by the deployment authority", () => {
  const account = bufferAccount();
  assert.equal(validateDeploymentBufferAccount({ account, loader, authority, requiredDataLength: 128 }).status, "ready");
});

test("rejects a reused account owned by another program or not in Buffer state", () => {
  assert.throws(() => validateDeploymentBufferAccount({ account: bufferAccount({ owner: "11111111111111111111111111111111" }), loader, authority, requiredDataLength: 128 }), /upgradeable loader/);
  assert.throws(() => validateDeploymentBufferAccount({ account: bufferAccount({ state: 2 }), loader, authority, requiredDataLength: 128 }), /Buffer state/);
});

test("rejects an unauthorized, immutable, undersized, or executable buffer", () => {
  const wrongAuthority = Buffer.alloc(32, 7).toString("base64");
  const wrongAuthorityBytes = Buffer.from(wrongAuthority, "base64");
  const unauthorized = bufferAccount();
  wrongAuthorityBytes.copy(unauthorized.data, 5);
  assert.throws(() => validateDeploymentBufferAccount({ account: unauthorized, loader, authority, requiredDataLength: 128 }), /authority/);

  const immutable = bufferAccount();
  immutable.data[4] = 0;
  assert.throws(() => validateDeploymentBufferAccount({ account: immutable, loader, authority, requiredDataLength: 128 }), /authority/);
  assert.throws(() => validateDeploymentBufferAccount({ account: bufferAccount({ space: 64 }), loader, authority, requiredDataLength: 128 }), /too small/);
  assert.throws(() => validateDeploymentBufferAccount({ account: bufferAccount({ executable: true }), loader, authority, requiredDataLength: 128 }), /executable/);
});

test("requires enough data for the new program image before reusing a buffer", () => {
  assert.throws(() => validateDeploymentBufferAccount({ account: bufferAccount({ space: 127 }), loader, authority, requiredDataLength: 128 }), /too small/);
});

test("uses the size-optimized SBF build for Devnet deployment affordability", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(packageJson.scripts["solana:build"], /--optimize-size/);
});

test("keeps large program writes off the configured read-verification RPC by default", () => {
  const deployScript = readFileSync(new URL("./deploy-devnet.sh", import.meta.url), "utf8");
  assert.match(deployScript, /WRITE_RPC="\$\{SOLANA_DEPLOY_RPC_URL:-https:\/\/api\.devnet\.solana\.com\}"/);
  assert.match(deployScript, /VERIFY_RPC="\$\{SOLANA_RPC_URL:-\$WRITE_RPC\}"/);
  assert.match(deployScript, /SOLANA_DEPLOY_USE_TPU:-true/);
});

test("requires buffer rent only when the buffer does not already exist", () => {
  assert.equal(minimumDeploymentBalance({ bufferRentSol: "2.2397974", reserveSol: "0.05", reusableBuffer: false }), "2.289797400");
  assert.equal(minimumDeploymentBalance({ bufferRentSol: "2.2397974", reserveSol: "0.05", reusableBuffer: true }), "0.050000000");
});

test("rejects invalid deployment funding inputs", () => {
  assert.throws(() => minimumDeploymentBalance({ bufferRentSol: "unknown", reserveSol: "0.05", reusableBuffer: false }), /finite non-negative/);
  assert.throws(() => minimumDeploymentBalance({ bufferRentSol: "2", reserveSol: "-1", reusableBuffer: false }), /finite non-negative/);
});
