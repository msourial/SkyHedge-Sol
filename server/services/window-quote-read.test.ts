import { expect } from "chai";
import { createMobileApiHandler, sharedDevnetStatusReader } from "./mobile-api";
import { marketsForWindowQuote } from "./window-quote-read";
import type { DevnetStatus } from "./devnet-status";

function recorder() {
  let statusCode = 200;
  let body: unknown;
  const response = {
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { body = value; return this; },
    setHeader() {},
  };
  return { response, result: () => ({ statusCode, body }) };
}

const window = {
  city: "new-york", peril: "snow", tenor: "monthly", status: "ready", address: "NySnow71", marketId: "16",
  observationStart: Date.UTC(2026, 11, 1) / 1000, observationEnd: Date.UTC(2027, 0, 1) / 1000, salesCloseAt: Date.UTC(2026, 11, 1) / 1000,
  thresholdMmX100: "7100", operator: "gte", quoteProbabilityBps: 5000, premiumRateBps: 5850, quoteInputsHash: "hash",
};

describe("window-quote market attachment", () => {
  it("attaches an open market from the status read", async () => {
    const markets = await marketsForWindowQuote(async () => ({ cityWindows: [window] }) as unknown as DevnetStatus, "new-york", "snow", "2026-12-01", "2027-01-01");
    expect(markets.map((m) => [m.address, m.scaledX100])).to.deep.equal([["NySnow71", 7100]]);
  });

  it("surfaces a failed chain read as DATA_UNAVAILABLE instead of an empty market list", async () => {
    const read = marketsForWindowQuote(async () => { throw new Error("429 Too Many Requests from https://rpc.example/secret-key"); }, "new-york", "snow", "2026-12-01", "2027-01-01");
    const error = await read.then(() => null, (e: unknown) => e as Error & { code?: string });
    expect(error?.code).to.equal("DATA_UNAVAILABLE");
    expect(error?.message).to.not.include("secret-key");
  });

  it("answers 503 DATA_UNAVAILABLE (not 409 not-open) when the chain read fails", async () => {
    const record = recorder();
    await createMobileApiHandler({
      readWindowQuote: (query) => marketsForWindowQuote(async () => { throw new Error("429"); }, query.cityId, "snow", query.windowStart, query.windowEnd) as never,
    })({ method: "GET", query: { resource: "window-quote", city: "new-york", peril: "snow", windowStart: "2026-12-01", windowEnd: "2027-01-01" } } as never, record.response as never);
    expect(record.result().statusCode).to.equal(503);
    expect((record.result().body as { error: string }).error).to.equal("DATA_UNAVAILABLE");
  });

  it("shares one status reader across window-quote requests in an instance", () => {
    expect(sharedDevnetStatusReader()).to.equal(sharedDevnetStatusReader());
  });
});
