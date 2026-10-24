import { expect } from "chai";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseNoaaDailyRainfall, canonicalSourceHash, DataUnavailableError } from "./noaa";
import { aggregateWindowTenths, nativeFromDly, parseCdoObservation, parseDlyElement } from "./ghcnd-daily";
import { buildDemoPlan, loadAnalogueSeries } from "./demo-keeper-plan";
import { buildWindowQuote } from "./window-quote";
import { readCatalogueWindowQuote } from "./window-quote-read";
import { evidenceHashes, encodeStrike, cityHashBytes } from "./window-keeper";
import { planMissingRungs, premiumBaseMap, priceFromHitCount, selectRungThresholds } from "../../shared/rung-plan";
import { ceilWholeTenths } from "../../shared/rung-plan";
import { strikeFromAnalogueTotals } from "../../shared/window-ladder";
import type { LadderWindow } from "../../shared/window-ladder";

const fixture = (name: string) => readFileSync(new URL(`../fixtures/ghcnd/${name}`, import.meta.url), "utf8");

function week(start: string, end: string): LadderWindow {
  const observationStart = Date.parse(`${start}T00:00:00.000Z`) / 1_000;
  const observationEnd = Date.parse(`${end}T00:00:00.000Z`) / 1_000;
  return { tenor: "weekly", salesCloseAt: observationStart, observationStart, observationEnd };
}

function series(city: string, peril: string, start: string) {
  const row = loadAnalogueSeries().find((item) => item.city === city && item.peril === peril && item.windowStart === start);
  if (!row?.totalTenths) throw new Error(`missing ${city} ${peril} ${start}`);
  return row.totalTenths;
}

describe("GHCN peril fixtures", () => {
  it("rejects the K measurement flag for rain and accepts it for wind", () => {
    const line = fixture("chicago-wsf2-201610.dly");
    const original = parseDlyElement(line, "USW00094846", "WSF2");
    const flagged = parseDlyElement(`${line.slice(0, 26)}K${line.slice(27)}`, "USW00094846", "WSF2");
    expect(original.length).to.be.greaterThan(0);
    expect(nativeFromDly("wind", flagged[0]!)).to.equal(nativeFromDly("wind", original[0]!));
    const day = original[0]!;
    expect(() => parseNoaaDailyRainfall({ date: day.date, value: 1, attributes: "K,,," })).to.throw(DataUnavailableError, /measurement flag K/);
    expect(() => parseCdoObservation("rain", { date: day.date, value: 1, attributes: "K,,," })).to.throw(/measurement flag K/);
  });

  it("counts a trace snowfall as an observed zero, not a missing day", () => {
    const days = parseDlyElement(fixture("chicago-snow-201612.dly"), "USW00094846", "SNOW");
    const trace = days.find((day) => day.raw === 0 && day.measurementFlag === "T");
    expect(trace, "Chicago December 2016 SNOW contains a trace").to.exist;
    expect(nativeFromDly("snow", trace!)).to.equal(0);
    expect(aggregateWindowTenths("snow", days, "2016-12-01", "2017-01-01")).to.be.a("number");
  });

  it("throws when an analogue month is missing a day", () => {
    const days = parseDlyElement(fixture("seattle-prcp-202112.dly"), "USW00024233", "PRCP");
    const missing = days.find((day) => day.raw == null);
    expect(missing?.date).to.equal("2021-12-18");
    expect(() => aggregateWindowTenths("rain", days, "2021-12-01", "2022-01-01")).to.throw(DataUnavailableError, /2021-12-18/);
  });

  it("rounds wind and heat strikes to a tenth and rain to a whole unit", () => {
    const wind = selectRungThresholds(series("chicago", "wind", "2026-10-26"), "tenth");
    const windRank8 = wind.find((rung) => rung.rank === 8)!;
    expect(windRank8.triggerValue).to.equal(13.4);
    expect(windRank8.scaledX100).to.equal(1340);
    expect(ceilWholeTenths(Math.round(windRank8.triggerValue * 10)) / 10).to.equal(14);
    const heat = selectRungThresholds(series("miami", "heat", "2026-10-26"), "tenth");
    expect(heat.find((rung) => rung.rank === 8)!.triggerValue).to.equal(32.2);
    expect(ceilWholeTenths(322) / 10).to.equal(33);
    const rainTenths = series("new-york", "rain", "2026-10-26");
    const rain = selectRungThresholds(rainTenths, "whole");
    const rank8 = rain.find((rung) => rung.rank === 8)!;
    expect(rank8.triggerValue).to.equal(69);
    expect(rank8.hits).to.equal(2);
    expect(strikeFromAnalogueTotals(rainTenths.map((tenths) => tenths / 10))).to.equal(69);
    expect(encodeStrike({ thresholdMm: 69 })).to.equal(6900n);
    expect(encodeStrike({ thresholdMm: null, scaledX100: 1340 })).to.equal(1340n);
  });

  it("prices each peril with the shared curve, including the 1% floor", () => {
    const twoHits = priceFromHitCount(2, null, 69);
    expect(twoHits).to.include({ probabilityBps: 2_000, premiumRateBps: 2_400, forecastWeight: 0 });
    expect(premiumBaseMap(2_400)).to.deep.equal({ "50": "12000000", "100": "24000000", "250": "60000000" });
    const floor = priceFromHitCount(0, null, 14.3);
    expect(floor).to.include({ probabilityBps: 100, premiumRateBps: 215, forecastWeight: 0 });
    const snow = selectRungThresholds(series("chicago", "snow", "2026-11-09"), "whole");
    expect(snow.map((rung) => rung.triggerValue)).to.deep.equal([3, 43, 91]);
    expect(selectRungThresholds(series("new-york", "snow", "2026-12-01"), "whole").find((rung) => rung.rank === 8)).to.include({ triggerValue: 183, hits: 3 });
    expect(selectRungThresholds(series("chicago", "snow", "2026-11-01"), "whole").find((rung) => rung.rank === 8)!.triggerValue).to.equal(94);
    expect(selectRungThresholds(series("chicago", "snow", "2026-12-01"), "whole").find((rung) => rung.rank === 8)!.triggerValue).to.equal(135);
    expect(selectRungThresholds(series("miami", "heat", "2026-11-01"), "tenth").find((rung) => rung.rank === 8)!.triggerValue).to.equal(31.7);
    expect(selectRungThresholds(series("chicago", "wind", "2026-11-01"), "tenth").find((rung) => rung.rank === 8)!.triggerValue).to.equal(17.4);
  });

  it("plans three distinct rungs and does not recreate the pinned rank-8 market", () => {
    const window = week("2026-10-26", "2026-11-02");
    const rungs = selectRungThresholds(series("new-york", "rain", "2026-10-26"), "whole");
    expect(rungs).to.have.length(3);
    expect(new Set(rungs.map((rung) => rung.scaledX100)).size).to.equal(3);
    const pinned = rungs.find((rung) => rung.rank === 8)!;
    const steps = planMissingRungs([{
      city: "new-york",
      peril: "rain",
      observationStart: window.observationStart,
      observationEnd: window.observationEnd,
      scaledX100: pinned.scaledX100,
      operator: "gte",
      state: "open",
      address: "PinnedRank8",
    }], "new-york", "rain", window, rungs);
    expect(steps.map((step) => step.action)).to.deep.equal(["create-fund-open", "keep", "create-fund-open"]);
    expect(steps.find((step) => step.action === "keep")?.existing?.address).to.equal("PinnedRank8");
    expect(steps.filter((step) => step.action === "create-fund-open").map((step) => step.scaledX100)).to.not.include(pinned.scaledX100);
  });

  it("returns a modelled WindowQuote that cannot point at a market", async () => {
    const quote = await readCatalogueWindowQuote({ peril: "snow", cityId: "chicago", windowStart: "2026-11-09", windowEnd: "2026-11-16" });
    expect(quote.analogueYears).to.equal(10);
    expect(quote.unit).to.equal("mm");
    expect(quote.rungs).to.have.length(3);
    expect(quote.rungs.every((rung) => rung.marketAddress === null)).to.equal(true);
    expect(quote.rungs.filter((rung) => rung.isTopRung)).to.have.length(1);
    expect(quote.rungs.find((rung) => rung.isTopRung)?.triggerValue).to.equal(91);
    expect(quote.salesCloseAt).to.equal("2026-11-09T00:00:00.000Z");
    const open = buildWindowQuote({
      peril: "snow",
      cityId: "chicago",
      stationId: quote.stationId,
      windowStart: quote.windowStart,
      windowEnd: quote.windowEnd,
      salesCloseAt: quote.salesCloseAt,
      totalTenths: series("chicago", "snow", "2026-11-09"),
      forecastNative: null,
      markets: [{ scaledX100: 4300, address: "SnowRank8", operator: "gte", probabilityBps: 3_000, premiumRateBps: 3_550, quoteInputsHash: "ab".repeat(32) }],
    });
    expect(open.rungs.find((rung) => rung.triggerValue === 43)?.marketAddress).to.equal("SnowRank8");
    expect(open.rungs.find((rung) => rung.triggerValue === 3)?.marketAddress).to.equal(null);
  });

  it("keeps the six Devnet strikes that match a demo rung and creates the others", () => {
    const plan = buildDemoPlan();
    const kept = plan.kept.map((line) => `${line.city} ${line.windowStart} ${line.triggerValue}`).sort();
    expect(kept).to.deep.equal([
      "des-moines 2026-10-26 33",
      "des-moines 2026-11-01 63",
      "des-moines 2026-12-01 50",
      "new-york 2026-10-26 69",
      "new-york 2026-11-01 102",
      "new-york 2026-12-01 166",
    ]);
    expect(plan.creates.some((line) => line.city === "chicago" && line.peril === "rain" && line.windowStart === "2026-10-26" && line.rank === 8)).to.equal(true);
    expect(plan.creates.some((line) => line.scaledX100 === 6900 && line.windowStart === "2026-10-26")).to.equal(false);
    expect(plan.approvals).to.equal(plan.creates.length * 3);
    expect(plan.fundSkyt).to.equal(plan.creates.length * 2000);
  });

  it("keeps the rain city hash and gives other perils their own methodology hash", () => {
    expect(cityHashBytes("new-york").toString("hex")).to.equal(createHash("sha256").update("new-york").digest("hex"));
    expect(cityHashBytes("chicago", "snow").toString("hex")).to.equal(createHash("sha256").update("chicago:snow").digest("hex"));
    expect(cityHashBytes("chicago", "snow").equals(cityHashBytes("chicago"))).to.equal(false);
    const rain = evidenceHashes("GHCND:USW00094728");
    const snow = evidenceHashes("GHCND:USW00094728", "snow");
    expect(rain.methodologyHash).to.equal(canonicalSourceHash("methodology-v1"));
    expect(snow.methodologyHash).to.equal(canonicalSourceHash("methodology-snow-v1"));
    expect(snow.methodologyHash).to.not.equal(rain.methodologyHash);
    expect(evidenceHashes("GHCND:USW00012839", "heat").methodologyHash).to.equal(canonicalSourceHash("methodology-heat-v1"));
    expect(evidenceHashes("GHCND:USW00094846", "wind").methodologyHash).to.equal(canonicalSourceHash("methodology-wind-v1"));
  });
});
