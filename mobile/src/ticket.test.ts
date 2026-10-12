import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { balanceCheck, coverageOptions, formatSkytFixed, premiumFeeLine, premiumPer100, returnMultiple, salesCountdown, shortAddress, shortUtcDate, triggerSentence } from "./ticket.ts";

describe("v2 Protect ticket helpers", () => {
  it("builds coverage chips with Max capped by 500 SKYT and the wallet balance", () => {
    assert.deepEqual(coverageOptions(null).map((o) => o.amountBase), ["50000000", "100000000", "250000000", "500000000"]);
    assert.equal(coverageOptions("1250000000")[3].amountBase, "500000000");
    assert.equal(coverageOptions("180500000")[3].amountBase, "180000000");
    const empty = coverageOptions("400000");
    assert.equal(empty[3].enabled, false);
    assert.equal(empty[3].amountBase, null);
  });
  it("computes the return multiple to one decimal", () => {
    assert.equal(returnMultiple("3150000", "100000000"), "31.7×");
    assert.equal(returnMultiple("0", "1"), null);
    assert.equal(returnMultiple(null, "1"), null);
  });
  it("splits premium and fee", () => {
    assert.equal(premiumFeeLine("3150000", "1000000"), "2.15 + 1.00");
    assert.equal(premiumFeeLine("1", "5"), null);
  });
  it("formats grouped fixed SKYT", () => {
    assert.equal(formatSkytFixed("1250000000"), "1,250.00");
    assert.equal(formatSkytFixed("1999999", 2), "1.99");
    assert.equal(formatSkytFixed("abc"), "—");
    assert.equal(formatSkytFixed("1234000000", 0), "1,234");
  });
  it("writes the trigger in plain English with an inclusive end date", () => {
    const start = Date.UTC(2026, 9, 6) / 1000, end = Date.UTC(2026, 9, 20) / 1000;
    assert.equal(shortUtcDate(start), "Oct 6");
    assert.equal(triggerSentence({ station: "Des Moines Intl Airport", thresholdMmX100: "2500", operator: "gte", start, end }), "Pays out if Des Moines Intl Airport records ≥ 25 mm of rain between Oct 6 and Oct 19.");
    assert.equal(triggerSentence({ station: "X", thresholdMmX100: "1250", operator: "lt", start: null, end: null }), "Pays out if X records < 12.5 mm of rain.");
    assert.equal(triggerSentence({ station: "X", thresholdMmX100: null, operator: "gte", start, end }), null);
  });
  it("counts down to sales close", () => {
    assert.equal(salesCountdown(100_000, 100_000 - (86_400 + 4 * 3_600 + 60)), "Closes 1d 4h");
    assert.equal(salesCountdown(10_000, 10_000 - (3 * 3_600 + 12 * 60)), "Closes 3h 12m");
    assert.equal(salesCountdown(100, 90), "Closes 1m");
    assert.equal(salesCountdown(100, 100), "Sales closed");
    assert.equal(salesCountdown(null, 1), null);
  });
  it("scales a real quote to per-100 pricing", () => {
    assert.equal(premiumPer100("2150000", "100000000"), "2.15");
    assert.equal(premiumPer100("6300000", "200000000"), "3.15");
    assert.equal(premiumPer100("1", "0"), null);
  });
  it("shortens addresses and checks balances", () => {
    assert.equal(shortAddress("DKA9abcdefghijklmnopFD6y"), "DKA9…FD6y");
    assert.equal(balanceCheck("5000000", "3150000"), "enough");
    assert.equal(balanceCheck("1000000", "3150000"), "short");
    assert.equal(balanceCheck(null, "1"), "unknown");
  });
});

import { quoteErrorTitle, transactionErrorTitle } from "./friendly-errors.ts";
describe("action-oriented error titles", () => {
  it("names the wallet when it declined", () => {
    assert.equal(transactionErrorTitle("authorization request failed", "Phantom"), "Phantom didn't approve — try again");
    assert.equal(transactionErrorTitle("User rejected the request"), "Your wallet didn't approve — try again");
    assert.equal(transactionErrorTitle("Network request failed"), "You're offline — reconnect and try again");
    assert.equal(transactionErrorTitle("weird"), "That didn't go through — try again");
  });
  it("titles quote errors", () => {
    assert.equal(quoteErrorTitle("fetch failed"), "Can't get a price offline — retry when connected");
    assert.equal(quoteErrorTitle("bad"), "Couldn't price this coverage — try again");
  });
});
