import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authorizeForSigning, DEVNET_CHAIN } from "./wallet-auth.ts";

describe("authorizeForSigning", () => {
  it("sends exactly one fresh authorize on solana:devnet, never the cached token", async () => {
    const calls: any[] = [];
    const r = await authorizeForSigning({ authorize: async (p) => { calls.push(p); return "ok"; } }, "cached-token");
    assert.equal(r, "ok");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].chain, DEVNET_CHAIN);
    assert.equal(calls[0].auth_token, undefined, "a token becomes sol_mwa_reauthorize, which Phantom declines");
    assert.equal(calls[0].identity.uri, "https://skyhedge.app");
  });
  it("does not retry inside the session, where Phantom stops answering", async () => {
    let calls = 0;
    await assert.rejects(authorizeForSigning({ authorize: async () => { calls++; throw new Error("authorization request failed"); } }, "tok"));
    assert.equal(calls, 1);
  });
});
