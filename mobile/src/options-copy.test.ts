import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hedgeBalanceLine, hedgeWindowDays, marketHeadline, optionPremiumLine, triggerPhrase } from "./options-copy.ts";

describe("options-style Protect copy", () => {
  it("computes the hedge window in days", () => {
    assert.equal(hedgeWindowDays(1791936000, 1792368000), 5);
    assert.equal(hedgeWindowDays(null, 1), null);
    assert.equal(hedgeWindowDays(10, 5), null);
  });
  it("leads with a plain headline when open and a human one when not", () => {
    assert.deepEqual(marketHeadline({ place: "Des Moines", open: true, days: 5 }), { title: "Des Moines is open", detail: "Protect against rain over the next 5 days." });
    assert.equal(marketHeadline({ place: "Des Moines", open: false, days: 5 }).title, "New Des Moines protection opens soon");
    assert.equal(marketHeadline({ place: "Des Moines", open: true, days: 1 }).detail, "Protect against rain over the next 1 day.");
  });
  it("states the coverage balance honestly", () => {
    assert.equal(hedgeBalanceLine("1500000000", true), "You have 1500 SKYT for coverage");
    assert.match(hedgeBalanceLine(null, true), /isn't available/);
    assert.match(hedgeBalanceLine("1", false), /Connect your wallet/);
  });
  it("reads a quote like an option premium", () => {
    assert.equal(optionPremiumLine("4355000", "100000000", "5000", "gte"), "Pay 4.355 SKYT, get up to 100 SKYT if rainfall reaches 50 mm or more.");
    assert.equal(triggerPhrase("1000", "lte"), "if rainfall stays at or below 10 mm");
    assert.equal(triggerPhrase(null, null), "if rainfall crosses the trigger");
  });
});
