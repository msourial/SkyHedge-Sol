import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authorizeForSigning, DEVNET_CHAIN } from "./wallet-auth.ts";

describe("authorizeForSigning", () => {
  it("uses authorize (not reauthorize) with the cached token and solana:devnet", async () => {
    const calls: any[] = [];
    const r = await authorizeForSigning({ authorize: async (p) => { calls.push(p); return "ok"; } }, "tok");
    assert.equal(r, "ok");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].chain, DEVNET_CHAIN);
    assert.equal(calls[0].auth_token, "tok");
    assert.equal(calls[0].identity.uri, "https://skyhedge.vercel.app");
  });
  it("falls back to a fresh authorize when the cached token is rejected", async () => {
    const calls: any[] = [];
    const r = await authorizeForSigning({ authorize: async (p) => {
      calls.push(p);
      if (p.auth_token) throw new Error("authorization request failed");
      return "fresh";
    } }, "stale");
    assert.equal(r, "fresh");
    assert.equal(calls.length, 2);
    assert.equal(calls[1].auth_token, undefined);
  });
});
