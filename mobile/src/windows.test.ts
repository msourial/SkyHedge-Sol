import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DevnetStatus } from "./api.ts";
import { basisLine, liveMarketLabel, NEXT_WINDOW_COPY, sellingWindows, soonestWindow, windowsForTenor } from "./windows.ts";

const week = {
  city: "des-moines" as const,
  tenor: "weekly" as const,
  status: "ready" as const,
  address: "week",
  marketId: "3",
  vault: "vault",
  vaultBalance: "2000000000",
  onchainStatus: "{\"open\":{}}",
  salesCloseAt: 1_900_000_000,
  observationStart: 1_900_000_000,
  observationEnd: 1_900_604_800,
  thresholdMmX100: "1300",
  operator: "gte" as const,
  quoteProbabilityBps: 2_000,
  premiumRateBps: 2_400,
  quoteInputsHash: "ab",
  evidenceStatus: "validated" as const,
};
const month = { ...week, tenor: "monthly" as const, address: "month", marketId: "4", salesCloseAt: 1_910_000_000, observationStart: 1_910_000_000, observationEnd: 1_912_000_000, thresholdMmX100: "8100" };

describe("selling windows", () => {
  it("defaults to the soonest open expiry and hides a closed rung", () => {
    const status = { cityWindows: [month, { ...week, salesCloseAt: 1_000 }, week] } as DevnetStatus;
    const open = sellingWindows(status, 1_800_000_000);
    assert.deepEqual(open.map((window) => window.address), ["week", "month"]);
    assert.equal(soonestWindow(open, "weekly")?.address, "week");
    assert.equal(soonestWindow(open, "monthly")?.address, "month");
    assert.deepEqual(windowsForTenor(open, "weekly").map((window) => window.address), ["week"]);
    assert.equal(liveMarketLabel(open), "Weekly · Monthly open");
  });

  it("never uses a dead-end empty state", () => {
    assert.equal(liveMarketLabel([]), NEXT_WINDOW_COPY);
    assert.equal(sellingWindows(null, 1).length, 0);
    assert.equal(NEXT_WINDOW_COPY.includes("isn't selling"), false);
    assert.equal(NEXT_WINDOW_COPY.includes("Sales closed"), false);
    assert.equal(basisLine("Des Moines Intl", "monthly").includes("8th of 10"), true);
  });

  it("falls back to an open desMoinesMarket when cityWindows is missing", () => {
    const status = {
      desMoinesMarket: {
        status: "ready",
        address: "HDJi",
        marketId: "2",
        vault: "vault",
        vaultBalance: "2000000000",
        onchainStatus: '{"Open":{}}',
        salesCloseAt: 1_900_000_000,
        observationStart: 1_792_368_000,
        observationEnd: 1_792_800_000,
        thresholdMmX100: "5000",
        operator: "gte",
        quoteProbabilityBps: 700,
        premiumRateBps: 905,
        quoteInputsHash: "ab",
        evidenceStatus: "validated",
        targetCityHash: "x",
      },
    } as DevnetStatus;
    const open = sellingWindows(status, 1_792_200_000);
    assert.equal(open.length, 1);
    assert.equal(open[0]?.address, "HDJi");
    assert.equal(open[0]?.tenor, "weekly");
    assert.equal(liveMarketLabel(open), "Weekly open");
  });
});
