import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dealSentence, payoutStage, showCityStep, stepLabel, ONBOARDING_STEPS, TEST_TOKEN_NOTE } from "./consumer-flow.ts";

const B = 1_000_000n;
describe("consumer flow copy", () => {
  it("builds a plain deal sentence only from real numbers", () => {
    const s = dealSentence({ place: "Des Moines", premiumBase: String(3n * B + 200_000n), payoutBase: String(100n * B), thresholdMmX100: "5000", operator: "gte", start: Date.UTC(2026, 9, 14) / 1000, end: Date.UTC(2026, 9, 21) / 1000 });
    assert.equal(s, "You pay 3.20 SKYT. You get 100 SKYT if Des Moines gets 50 mm of rain or more between Oct 14 and Oct 20.");
    assert.equal(dealSentence({ place: "X", premiumBase: null, payoutBase: "1", thresholdMmX100: "5000", operator: "gte", start: 1, end: 999999 }), null);
    assert.equal(dealSentence({ place: "X", premiumBase: "1", payoutBase: "1", thresholdMmX100: null, operator: "gte", start: 1, end: 999999 }), null);
  });
  it("maps claim readiness to four consumer states", () => {
    assert.equal(payoutStage(null), null);
    assert.equal(payoutStage({ state: "no_position", action: null }), null);
    assert.equal(payoutStage({ state: "pending", action: null })?.key, "waiting");
    assert.equal(payoutStage({ state: "claimable", action: "claim_payout" })?.key, "triggered");
    assert.equal(payoutStage({ state: "claimable", action: "claim_premium_refund" })?.key, "refund");
    assert.equal(payoutStage({ state: "not_claimable", action: null })?.key, "not_triggered");
  });
  it("shows the city step only on a first run with no wallet and no position", () => {
    assert.equal(showCityStep({ firstRun: true, walletConnected: false, hasPosition: false }), true);
    assert.equal(showCityStep({ firstRun: false, walletConnected: false, hasPosition: false }), false);
    assert.equal(showCityStep({ firstRun: true, walletConnected: true, hasPosition: false }), false);
    assert.equal(showCityStep({ firstRun: true, walletConnected: false, hasPosition: true }), false);
  });
  it("avoids jargon", () => {
    const all = [TEST_TOKEN_NOTE, stepLabel(2), ...ONBOARDING_STEPS.flatMap((s) => [s.title, s.body])].join(" ").toLowerCase();
    for (const w of ["parametric", "oracle", "exposure"]) assert.ok(!all.includes(w));
  });
});
