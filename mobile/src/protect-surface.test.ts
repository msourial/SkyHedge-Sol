import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buyCtaVisible,
  coverageChipOn,
  gaugeMode,
  nextWeeklyOpenCopy,
  openCityPrompt,
  protectSurface,
} from "../../shared/protect-surface.ts";

const NOW = Date.UTC(2026, 9, 20, 3, 35, 26) / 1000;

describe("protect surface", () => {
  it("treats a failed status read as an error, not a closed window", () => {
    assert.equal(protectSurface({ loading: false, failed: true, openWindowCount: 0 }), "error");
    assert.equal(protectSurface({ loading: true, failed: true, openWindowCount: 0 }), "loading");
  });

  it("uses the closed card only when the read succeeded and nothing is selling", () => {
    assert.equal(protectSurface({ loading: false, failed: false, openWindowCount: 0 }), "closed");
    assert.equal(protectSurface({ loading: false, failed: false, openWindowCount: 2 }), "ready");
  });

  it("hides the buy bar unless a window is priced", () => {
    assert.equal(buyCtaVisible("loading", false), false);
    assert.equal(buyCtaVisible("error", false), false);
    assert.equal(buyCtaVisible("closed", false), false);
    assert.equal(buyCtaVisible("ready", false), false);
    assert.equal(buyCtaVisible("ready", true), true);
  });

  it("does not select the 50 SKYT chip when nothing is priced", () => {
    assert.equal(coverageChipOn(false, "50", "50"), false);
    assert.equal(coverageChipOn(false, "50", "100"), false);
    assert.equal(coverageChipOn(true, "100", "100"), true);
    assert.equal(coverageChipOn(true, "50", "100"), false);
  });

  it("never shows an empty gauge", () => {
    assert.equal(gaugeMode({ surface: "loading", evidenceLoading: false, pricedRowCount: 0 }), "skeleton");
    assert.equal(gaugeMode({ surface: "ready", evidenceLoading: true, pricedRowCount: 0 }), "skeleton");
    assert.equal(gaugeMode({ surface: "closed", evidenceLoading: false, pricedRowCount: 0 }), "hidden");
    assert.equal(gaugeMode({ surface: "error", evidenceLoading: false, pricedRowCount: 0 }), "hidden");
    assert.equal(gaugeMode({ surface: "ready", evidenceLoading: false, pricedRowCount: 0 }), "hidden");
    assert.equal(gaugeMode({ surface: "ready", evidenceLoading: false, pricedRowCount: 1 }), "gauge");
  });

  it("names the next weekly open from the ladder clock, and only a city that is actually open", () => {
    assert.equal(nextWeeklyOpenCopy("new-york", NOW), "New York's next weekly window opens Oct 26, 00:00 UTC");
    assert.equal(openCityPrompt([{ city: "new-york" }], "new-york"), null);
    assert.deepEqual(openCityPrompt([{ city: "des-moines" }, { city: "new-york" }], "new-york"), {
      slug: "des-moines",
      label: "Des Moines is open now",
    });
  });
});
