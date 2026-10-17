import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseStoredWalletSession } from "./wallet-session.ts";

const address = "DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y";

describe("stored wallet session", () => {
  it("restores an address and auth token", () => {
    const session = parseStoredWalletSession(JSON.stringify({ address, authToken: "token-12345678" }));
    assert.deepEqual(session, { address, authToken: "token-12345678" });
  });

  it("drops a missing token, a short token, or a bad address", () => {
    assert.equal(parseStoredWalletSession(null), null);
    assert.equal(parseStoredWalletSession("{"), null);
    assert.equal(parseStoredWalletSession(JSON.stringify({ address, authToken: "short" })), null);
    assert.equal(parseStoredWalletSession(JSON.stringify({ address: "not-a-key", authToken: "token-12345678" })), null);
  });
});
