import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSignAndSendParams } from "./wallet-send.ts";

describe("buildSignAndSendParams", () => {
  it("always includes a numeric minContextSlot", () => {
    const p = buildSignAndSendParams(["tx"], 123);
    assert.deepEqual(p.transactions, ["tx"]);
    assert.equal(p.minContextSlot, 123);
  });
  it("rejects a missing slot", () => {
    assert.throws(() => buildSignAndSendParams(["tx"], undefined as unknown as number));
  });
});
