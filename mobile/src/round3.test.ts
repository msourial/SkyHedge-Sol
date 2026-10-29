import assert from "node:assert/strict";
import { test } from "node:test";
import { coverGauge, forecastChip, purchaseState, payoutSteps, shouldShowMultipleTip, dismissMultipleTip, MULTIPLE_TIP_KEY } from "./round3.ts";
import { TransactionFailedError } from "./buy-phase.ts";
import { signFailure } from "./line-submit.ts";
import type { CoverProgress, ForecastEdge } from "./api.ts";
import { receiptModel } from "../../shared/ui-discovery.ts";
const receipt = { ...receiptModel({ address: "cover", market: "market", premiumPaid: "47000000", protectedAmount: "100000000", city: "New York", peril: "rain", triggerValue: 2, statusLabel: "Active" }, [], []), windowStart: "2026-11-02", windowEnd: "2026-11-09", unit: "mm" };
const now = Date.parse("2026-11-06");
const progress: CoverProgress = { state: "tracking", valueNative: 1.2, unit: "mm", observedThrough: "2026-11-04", daysReported: 3, daysTotal: 7, complete: false, source: "NOAA GHCN-Daily via CDO v2", fetchedAt: "2026-11-06" };
test("gauge never substitutes a final claim reading or a missing value with zero", () => {
  const g = coverGauge({ ...receipt, reading: 123 }, null, now);
  assert.equal(g.value, null); assert.equal(g.fraction, 0); assert.equal(g.reading, "Rain so far unavailable");
  assert.equal(coverGauge(receipt, { ...progress, valueNative: 0 }, now).reading, "0.0 of 2 mm");
  assert.equal(coverGauge({ ...receipt, peril: "wind", unit: "m/s" }, progress, now).value, null);
});
test("gauge maps start, tracking, hit, waiting, complete and settlement states", () => {
  assert.equal(coverGauge(receipt, null, Date.parse("2026-11-01")).state, "not_started");
  const g = coverGauge(receipt, progress, now);
  assert.equal(g.state, "tracking"); assert.equal(g.fraction, .6); assert.equal(g.daysLeft, 3); assert.equal(g.through, "NOAA through Nov 4"); assert.equal(g.coverage, "3 of 7 days reported");
  assert.equal(coverGauge(receipt, { ...progress, valueNative: 2.6 }, now).state, "hit");
  assert.equal(coverGauge(receipt, progress, Date.parse("2026-11-10")).state, "ended_waiting");
  assert.equal(coverGauge(receipt, { ...progress, state: "complete", complete: true }, Date.parse("2026-11-10")).state, "complete");
  for (const [kind, state] of [["pending", "ready"], ["paid", "paid"], ["dry", "expired"], ["refunded", "refunded"]] as const) assert.equal(coverGauge({ ...receipt, kind }, progress, now).state, state);
  assert.equal(coverGauge({ ...receipt, peril: "snow", unit: "cm" }, { ...progress, valueNative: 12 }, now).value, 1.2);
});
test("edge visibility requires five points in either direction and an ensemble signal", () => {
  const edge = (probability: number): ForecastEdge => ({ historyProbability: .2, forecast: { probability } as ForecastEdge["forecast"] });
  assert.equal(forecastChip({ forecast: null, historyProbability: .2 }), null);
  assert.equal(forecastChip(edge(.249)), null); assert.equal(forecastChip(edge(.25))?.sign, "pos");
  assert.equal(forecastChip(edge(.15))?.sign, "neg"); assert.equal(forecastChip(edge(NaN)), null);
});
test("tip dismissal persists across new consumers using mocked app storage", async () => {
  const items = new Map<string, string>(), writes: string[] = [];
  const storage = { getItem: async (key: string) => items.get(key) ?? null, setItem: async (key: string, value: string) => { writes.push(key); items.set(key, value); } };
  assert.equal(await shouldShowMultipleTip(storage), true); await dismissMultipleTip(storage);
  assert.equal(await shouldShowMultipleTip({ ...storage }), false); assert.deepEqual(writes, [MULTIPLE_TIP_KEY]);
  assert.equal(await shouldShowMultipleTip({ ...storage, getItem: async () => { throw Error("unavailable"); } }), false);
});
test("purchase machine keeps approval on Protect and timeout pending, never confirms early", () => {
  assert.equal(purchaseState({ status: "review" }), "hidden");
  assert.equal(purchaseState({ status: "progress", step: "wallet" }), "hidden");
  for (const step of ["send", "confirm"] as const) assert.equal(purchaseState({ status: "progress", step }), "pending");
  assert.equal(purchaseState({ status: "success" }), "success");
  assert.equal(purchaseState({ status: "error", kind: "declined" }), "cancelled");
  assert.equal(purchaseState({ status: "error", kind: "unconfirmed" }, null, true), "still_confirming");
  assert.equal(purchaseState({ status: "error", kind: "other" }), "failed");
  assert.equal(purchaseState({ status: "error", kind: "already-covered" }), "hidden");
  const outcome = signFailure(new TransactionFailedError("Invalid market parameters (6001)", "signature", true), true);
  assert.equal(outcome.kind === "error" && outcome.error, "other");
});
test("payout explanation names Phantom approval, data deadline and live amounts", () => {
  const text = payoutSteps({ station: "Central Park", peril: "rain", end: "Nov 9", pay: "47.00", payout: "100.00" }).map(s => `${s.title} ${s.body}`).join(" ");
  assert.match(text, /Collect with one tap/); assert.doesNotMatch(text, /automatic/i);
  assert.match(text, /approve one transaction in Phantom/); assert.match(text, /30 days of the data deadline/);
  assert.match(text, /Central Park/); assert.match(text, /47.00/); assert.match(text, /100.00/);
});
