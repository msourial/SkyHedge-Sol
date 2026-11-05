import assert from "node:assert/strict";
import { test } from "node:test";
import { fundingReason } from "./funding.ts";
test("known insufficient SKYT shows exact premium and balance with Wallet help", () => {
  assert.equal(fundingReason("24123456", "0"), "You need 24.123456 SKYT to buy this cover. You have 0.000000. Open Wallet for funding help.");
  assert.match(fundingReason("24123456", "12000000")!, /You have 12.000000/);
  assert.equal(fundingReason("24123456", "24123456"), null);
});
test("unknown balances remain unknown; zero SOL explains fees and links the faucet", () => {
  assert.equal(fundingReason("24123456", null), null);
  assert.equal(fundingReason("24123456", "unknown", null), null);
  assert.match(fundingReason("24123456", null, 0)!, /Devnet SOL.*fees.*https:\/\/faucet.solana.com/);
  assert.equal(fundingReason("24123456", null, 0.001), null);
});
