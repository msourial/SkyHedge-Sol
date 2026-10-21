import { expect } from "chai";
import {
  chanceLabel,
  daysToExpiry,
  daysToExpiryLabel,
  committedWindowLabel,
  expiryChipCopy,
  expiryChipLabel,
  measuredAtLine,
  pricePer100Label,
  payoutMultipleLabel,
  settlementLine,
  sortByExpiry,
  triggerLadderMm,
  triggerRows,
} from "../../shared/window-chain";

const WEEK = { observationStart: Date.parse("2026-10-19T00:00:00Z") / 1000, observationEnd: Date.parse("2026-10-26T00:00:00Z") / 1000 };
const NEXT_WEEK = { observationStart: Date.parse("2026-10-26T00:00:00Z") / 1000, observationEnd: Date.parse("2026-11-02T00:00:00Z") / 1000 };
const NOVEMBER = { observationStart: Date.parse("2026-11-01T00:00:00Z") / 1000, observationEnd: Date.parse("2026-12-01T00:00:00Z") / 1000 };
const TOTALS = [2, 4, 8, 10, 14, 18, 22, 29, 40, 61];

describe("options chain labels", () => {
  it("labels expiries by the UTC observation end and tenor, sorted by end", () => {
    expect(expiryChipLabel(WEEK)).to.equal("Oct 26 · W");
    expect(expiryChipLabel(NEXT_WEEK)).to.equal("Nov 2 · W");
    expect(committedWindowLabel(NEXT_WEEK)).to.equal("Oct 26 – Nov 2 (UTC)");
    expect(expiryChipLabel(NOVEMBER)).to.equal("Dec 1 · M");
    expect(sortByExpiry([NOVEMBER, WEEK, NEXT_WEEK]).map(expiryChipLabel)).to.deep.equal(["Oct 26 · W", "Nov 2 · W", "Dec 1 · M"]);
    const now = Date.parse("2026-10-17T15:00:00Z") / 1000;
    expect(daysToExpiryLabel(daysToExpiry(WEEK.observationEnd, now))).to.match(/^\d+ days$/);
    expect(settlementLine("NOAA Central Park")).to.equal("NOAA Central Park · settles after expiry from NOAA final data");
    expect(expiryChipCopy(WEEK, now)).to.equal("Weekly · ends Oct 26 · 9 days");
    expect(expiryChipCopy(NOVEMBER, now)).to.equal("Monthly · ends Dec 1 · 45 days");
    expect(measuredAtLine("NOAA Central Park", "Oct 26")).to.equal("Measured at NOAA Central Park. Pays out from NOAA's final numbers after Oct 26 (UTC).");
  });

  it("builds four to six triggers only from analogue ranks and the pinned market", () => {
    const ladder = triggerLadderMm(TOTALS, 29);
    expect(ladder.length).to.be.within(4, 6);
    expect(ladder).to.include(29);
    expect(triggerLadderMm([1, 2, 3], 29)).to.deep.equal([]);
    const rows = triggerRows({
      totalsMm: TOTALS,
      forecastCumulativeMm: null,
      onChainThresholdMm: 29,
      onChainProbabilityBps: 2_000,
      onChainPremiumRateBps: 2_400,
    });
    const live = rows.find((row) => row.onChain);
    expect(live?.thresholdMm).to.equal(29);
    expect(live?.probabilityBps).to.equal(2_000);
    expect(chanceLabel(live!.probabilityBps)).to.equal("20.0%");
    expect(pricePer100Label(live!.premiumRateBps)).to.equal("24.00");
    expect(payoutMultipleLabel(live!.premiumRateBps)).to.equal("4.1×");
    expect(rows.filter((row) => row.popular).map((row) => row.thresholdMm)).to.deep.equal([29]);
    expect(rows.some((row) => row.popular && !row.onChain)).to.equal(false);
    expect(rows.some((row) => !row.onChain && row.probabilityBps > 0)).to.equal(true);
  });
});
