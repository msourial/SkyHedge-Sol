import { expect } from "chai";
import { nextMarketLifecycleAction } from "./settlement";

describe("oracle worker market lifecycle", () => {
  const salesCloseAt = 1_800_000_000;
  const observationEnd = salesCloseAt + 7 * 24 * 60 * 60;

  it("leaves sales open until the immutable sales deadline", () => {
    expect(nextMarketLifecycleAction({ open: {} }, salesCloseAt - 1, salesCloseAt, observationEnd)).to.equal(null);
  });

  it("locks an open market at its sales deadline", () => {
    expect(nextMarketLifecycleAction({ open: {} }, salesCloseAt, salesCloseAt, observationEnd)).to.equal("lock_market");
  });

  it("waits for the observation window to finish before beginning settlement", () => {
    expect(nextMarketLifecycleAction("locked", observationEnd - 1, salesCloseAt, observationEnd)).to.equal(null);
    expect(nextMarketLifecycleAction({ locked: {} }, observationEnd, salesCloseAt, observationEnd)).to.equal("begin_settlement");
  });

  it("does not repeat lifecycle transitions for awaiting or terminal markets", () => {
    expect(nextMarketLifecycleAction({ awaitingSettlement: {} }, observationEnd, salesCloseAt, observationEnd)).to.equal(null);
    expect(nextMarketLifecycleAction({ settled: {} }, observationEnd, salesCloseAt, observationEnd)).to.equal(null);
  });
});
