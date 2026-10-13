import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buyCta, payState, utcDateTime } from "./ticket.ts";

const base = { busy: false, error: null, live: true, salesClosed: false, walletConnected: true };
describe("pay state", () => {
  it("shows a number only for a real quote premium", () => {
    assert.deepEqual(payState({ ...base, premiumBase: "3480000" }), { kind: "priced", label: "3.48" });
    assert.equal(payState({ ...base, premiumBase: null }).kind, "blocked");
  });
  it("explains loading, errors and closed sales instead of a dash", () => {
    assert.equal(payState({ ...base, premiumBase: null, busy: true }).label, "Pricing…");
    assert.equal(payState({ ...base, premiumBase: null, error: "x" }).label, "Price unavailable");
    assert.equal(payState({ ...base, premiumBase: null, live: false, salesClosed: true }).label, "Sales closed");
    assert.equal(payState({ ...base, premiumBase: null, walletConnected: false }).label, "Connect wallet");
  });
});
describe("buy button", () => {
  const b = { busy: false, error: null, blockedReason: null, paymentReason: null };
  it("is enabled with the premium in the label when priced", () => {
    assert.deepEqual(buyCta({ ...b, premiumBase: "3480000" }), { label: "Protect for 3.48 SKYT", disabled: false, hint: null });
  });
  it("is disabled with a reason otherwise", () => {
    assert.equal(buyCta({ ...b, premiumBase: null, blockedReason: "The market’s sales window has ended." }).hint, "The market’s sales window has ended.");
    assert.equal(buyCta({ ...b, premiumBase: "3480000", paymentReason: "short" }).disabled, true);
    assert.equal(buyCta({ ...b, premiumBase: null, busy: true }).disabled, true);
  });
});
describe("utcDateTime", () => {
  it("formats real timestamps and refuses missing ones", () => {
    assert.equal(utcDateTime(1792368000), "Oct 19, 00:00 UTC");
    assert.equal(utcDateTime(null), null);
  });
});
