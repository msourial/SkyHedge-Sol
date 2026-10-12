import { expect } from "chai";
import { canOfferInitialization, isProtocolInitialized, withTimeout } from "../../shared/protocol-init";

describe("owner console protocol gate", () => {
  it("accepts the server's finalized status when the client RPC check failed", () => {
    expect(isProtocolInitialized(null, { initialized: true, status: "ready" })).to.equal(true);
    expect(isProtocolInitialized(true, null)).to.equal(true);
    expect(isProtocolInitialized(null, { initialized: true, status: "unavailable" })).to.equal(false);
    expect(isProtocolInitialized(false, { initialized: false, status: "ready" })).to.equal(false);
  });
  it("never offers initialization when the server says initialized", () => {
    expect(canOfferInitialization(false, { initialized: true, status: "ready" })).to.equal(false);
    expect(canOfferInitialization(null, { initialized: false })).to.equal(false);
    expect(canOfferInitialization(false, { initialized: false, status: "ready" })).to.equal(true);
  });
  it("times out a hanging check", async () => {
    let error: unknown;
    try { await withTimeout(new Promise(() => {}), 20); } catch (e) { error = e; }
    expect(String(error)).to.include("timed out");
    expect(await withTimeout(Promise.resolve(1), 20)).to.equal(1);
  });
});
