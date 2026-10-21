import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { gaugeReading } from "../../shared/protect-surface.ts";
import { payGet, payGetBarWidths } from "../../shared/pay-get.ts";
import { committedWindowLabel, expiryChipCopy, expiryChipLabel, measuredAtLine, windowEndLabel } from "../../shared/window-chain.ts";

const NY_WEEKLY = { observationStart: 1_792_972_800, observationEnd: 1_793_577_600 }; // Oct 26 – Nov 2 00:00 UTC
const NOW = Date.parse("2026-10-20T20:00:00Z") / 1000;

describe("one date convention for header, chip, sheet and Wallet", () => {
  it("all name the UTC observation end, Nov 2", () => {
    assert.equal(committedWindowLabel(NY_WEEKLY), "Oct 26 – Nov 2 (UTC)");
    assert.equal(windowEndLabel(NY_WEEKLY), "Nov 2 (UTC)");
    assert.equal(expiryChipLabel(NY_WEEKLY), "Nov 2 · W");
    assert.equal(expiryChipCopy(NY_WEEKLY, NOW), "Weekly · ends Nov 2 · 13 days");
    assert.equal(measuredAtLine("NOAA Central Park", "Nov 2"), "Measured at NOAA Central Park. Pays out from NOAA's final numbers after Nov 2 (UTC).");
    assert.equal(measuredAtLine("NOAA Central Park", "Nov 2 (UTC)"), "Measured at NOAA Central Park. Pays out from NOAA's final numbers after Nov 2 (UTC).");
  });
});

describe("Protect polish", () => {
  it("never draws an unlabelled water level", () => {
    assert.deepEqual(gaugeReading({ forecastMm: null, observationStart: NY_WEEKLY.observationStart, nowSeconds: NOW, startLabel: "Oct 26 (UTC)" }), { levelMm: 0, caption: "Empty until rain counts from Oct 26 (UTC)" });
    assert.deepEqual(gaugeReading({ forecastMm: 31.26, observationStart: NY_WEEKLY.observationStart, nowSeconds: NOW, startLabel: null }), { levelMm: 31.3, caption: "Water = 31.3 mm NOAA forecast" });
    assert.equal(gaugeReading({ forecastMm: null, observationStart: NY_WEEKLY.observationStart, nowSeconds: NY_WEEKLY.observationStart + 1, startLabel: null }).levelMm, 0);
  });
  it("draws pay and get bars to scale", () => {
    const deal = payGet({ coverageSkyt: 100, premiumRateBps: 2400, probabilityBps: 2000 })!;
    assert.deepEqual(payGetBarWidths(deal.payBase, deal.getBase), { pay: 0.24, get: 1 });
    assert.equal(payGetBarWidths("1", "100000000")!.pay, 0.04);
    assert.equal(payGetBarWidths(null, "1"), null);
  });
  it("does not repeat chance and multiple under the bars", () => {
    const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    assert.ok(!app.includes("hint={deal ? `${deal.chance} · ${deal.multiple}`"));
  });
});
