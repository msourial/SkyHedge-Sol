import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readWalletStateWithFallback } from "./chain.ts";

const state = { sol: 1, skytBaseUnits: "100000000", skytDecimals: 6, slot: 1 };
describe("wallet balance fallback", () => {
  it("uses the direct RPC when it answers", async () => {
    assert.deepEqual(await readWalletStateWithFallback("w", { direct: async () => state, server: async () => { throw new Error("no"); } }), state);
  });
  it("falls back to the server when the phone RPC fails or hangs", async () => {
    assert.deepEqual(await readWalletStateWithFallback("w", { direct: async () => { throw new Error("429"); }, server: async () => state }), state);
    assert.deepEqual(await readWalletStateWithFallback("w", { direct: () => new Promise(() => {}), server: async () => state, timeoutMs: 20 }), state);
  });
  it("never invents a balance when both reads fail", async () => {
    await assert.rejects(readWalletStateWithFallback("w", { direct: async () => { throw new Error("a"); }, server: async () => { throw new Error("b"); } }));
  });
});
