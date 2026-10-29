import { expect } from "chai";
import { priceKeeperSteps } from "./window-keeper.js";
import { openLadder, priceFromHistory } from "../../shared/window-ladder.js";
import { priceFromHitCount } from "../../shared/rung-plan.js";
import { quoteFromCommittedMarketTerms } from "./quote-engine.js";
import { buildWindowQuote } from "./window-quote.js";

describe("history-only pinned Chance", () => {
  it("keeper ignores a non-null available forecast and commits history-only inputs", async () => {
    let forecastCalls = 0;
    const engine = { analogueTotals: async () => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      forecastCumulativeOrNull: async () => { forecastCalls++; return 100; } };
    const [result] = await priceKeeperSteps([{ action: "create-fund-open", city: "new-york", window: openLadder(Date.parse("2026-10-29") / 1000)[0] }], engine as never);
    expect(result).to.include({ probabilityBps: 3000, premiumRateBps: 3550, forecastIncluded: false });
    expect(forecastCalls).to.equal(0);
    expect(priceFromHistory(3000)).to.include({ probabilityBps: 3000, forecastWeight: 0 });
  });
  it("also marks skipped keeper steps as excluding forecasts", async () => {
    const [result] = await priceKeeperSteps([{ action: "create-fund-open", window: openLadder(Date.parse("2026-10-29") / 1000)[0] }]);
    expect(result.forecastIncluded).to.equal(false);
    expect(result.probabilityBps).to.equal(null);
  });
  it("rung-plan's pinned call and committed quote retain history chance and zero forecast weight", () => {
    expect(priceFromHitCount(2, null, 6)).to.include({ probabilityBps: 2000, forecastWeight: 0 });
    expect(quoteFromCommittedMarketTerms({ protectedAmount: 100_000_000n, probabilityBps: 2000, premiumRateBps: 2400, inputsHash: "ab".repeat(32) })).to.include({ probabilityBps: 2000, forecastWeight: 0 });
  });
  it("buyable rungs keep pinned history terms even when an unrelated forecast is supplied", () => {
    const base = { peril: "rain" as const, cityId: "new-york", stationId: "GHCND:USW00094728", windowStart: "2026-11-02", windowEnd: "2026-11-09", salesCloseAt: "2026-11-02T00:00:00Z", totalTenths: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100], markets: [{ address: "pinned", scaledX100: 800, operator: "gte" as const, probabilityBps: 3000, premiumRateBps: 3550, quoteInputsHash: "ab".repeat(32) }] };
    for (const forecastNative of [null, 0, 100]) {
      const rung = buildWindowQuote({ ...base, forecastNative }).rungs.find((r) => r.marketAddress === "pinned")!;
      expect(rung.chanceBps).to.equal(3000); expect(rung.premiumBase["100"]).to.equal("35500000");
    }
  });
});
