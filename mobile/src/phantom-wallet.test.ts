import assert from "node:assert/strict";
import { test } from "node:test";
import { phantomConfig } from "./phantom-config.ts";
import { selectWalletAdapter, type WalletAdapter } from "./wallet-adapter.ts";

test("Phantom requires exact opt-in and a non-empty App ID", () => {
  for (const flag of [undefined, "", "false", "TRUE", "1", " true "]) assert.equal(phantomConfig(flag, "id").enabled, false);
  for (const id of [undefined, "", "   "]) assert.equal(phantomConfig("true", id).enabled, false);
  assert.deepEqual(phantomConfig("true", " id ", " custom "), { enabled: true, appId: "id", scheme: "custom" });
  assert.equal(phantomConfig(undefined, undefined, undefined, "from-app-json").scheme, "from-app-json");
});
function adapter(address: string | null): WalletAdapter {
  return { address, async connect() { return { address: address!, authToken: "test" }; }, async disconnect() {}, async signAndSendTransaction() { return address!; } };
}
test("MWA is selected when disabled, absent, or embedded is disconnected", () => {
  const mwa = adapter("mwa");
  assert.equal(selectWalletAdapter(false, mwa, adapter("embedded")), mwa);
  assert.equal(selectWalletAdapter(true, mwa, null), mwa);
  assert.equal(selectWalletAdapter(true, mwa, adapter(null)), mwa);
});
test("connected embedded routes signing and falls back after disconnect", async () => {
  const mwa = adapter("mwa"), embedded = adapter("embedded");
  assert.equal(selectWalletAdapter(true, mwa, embedded), embedded);
  assert.equal(await selectWalletAdapter(true, mwa, embedded).signAndSendTransaction({} as never), "embedded");
  embedded.address = null;
  assert.equal(selectWalletAdapter(true, mwa, embedded), mwa);
});
