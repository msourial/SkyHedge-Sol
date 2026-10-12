import { expect } from "chai";
import { buildRecommendation } from "./advisory-recommendation";
import { offlineAdvisoryAnswer } from "./advisory-offline";
import type { DevnetStatus } from "./devnet-status";

const now = Date.UTC(2026, 9, 12, 23) / 1000;
const status = { desMoinesMarket: { address: "x", salesCloseAt: now + 4 * 3600, observationStart: Date.UTC(2026, 9, 14) / 1000, observationEnd: Date.UTC(2026, 9, 18) / 1000, thresholdMmX100: "5000", operator: "gte", premiumRateBps: 215 } } as unknown as DevnetStatus;

describe("guide recommendation", () => {
  it("recommends Des Moines with on-chain trigger, window and premium", () => {
    const r = buildRecommendation(status, now);
    expect(r.label).to.equal("Protect Des Moines · ≥ 50 mm rain · 100 SKYT coverage · from ~2.15 SKYT premium + 1% fee");
    expect(r.text).to.match(/Oct 14–Oct 18/).and.match(/about 4 h/).and.match(/Toronto Pearson/);
    expect(r.action).to.deep.equal({ type: "open_protect", market: "des-moines" });
  });
  it("never invents a price when status is unavailable", () => {
    const r = buildRecommendation(null, now);
    expect(r.label).to.match(/live price in wallet review/);
    expect(r.premiumPer100Skyt).to.equal(null);
  });
  it("prints samples", () => {
    for (const q of ["Saskatoon wedding this weekend", "I fly charters out of Des Moines"]) console.log(`SAMPLE[${q}]: ${offlineAdvisoryAnswer(q).message}\n\n${buildRecommendation(status, now).text}`);
  });
});
