import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { marketStatus } from "../../shared/pay-get.ts";
import { COVER_CHIPS, HOW_IT_SETTLES, WALLET_CHAIN_ERROR, coveredReceiptRows, gaugeTickOffset, gaugeWaterLevel, ladderLabelFontSize, ladderTicks, marketRowModel, marketStatusInk, moreTriggersSoon, protectButtonLabel, protectGaugeHeight, stakeSheetForCover, stationDisplayName, windowStamp } from "../../shared/protect-copy.ts";
import { triggerRows } from "../../shared/window-chain.ts";

const HASH = "ab".repeat(32);
const WINDOW = "Oct 26 – Nov 2 (UTC)";

describe("stake sheet math", () => {
  const base = { probabilityBps: 2_000, premiumRateBps: 2_400, inputsHash: HASH, station: stationDisplayName("NOAA Central Park"), triggerMm: 69, windowLabel: WINDOW };

  it("prices each cover chip from the quote, including the protocol fee field", () => {
    const hundred = stakeSheetForCover({ ...base, coverSkyt: 100 });
    assert.ok(hundred);
    assert.equal(hundred.payLine, "You pay 24.00 SKYT");
    assert.equal(hundred.getLine, "You get 100 SKYT");
    assert.equal(hundred.conditionLine, "If Central Park ≥ 69 mm by Nov 2");
    assert.equal(hundred.ledgerGetLine, "You get 100 SKYT if Central Park hits 69 mm by Nov 2");
    assert.equal(hundred.ledgerMeta, "20.0% chance · 4.1× · 1.00 SKYT fee included");
    assert.equal(hundred.multiple, "4.1×");
    assert.equal(hundred.feeLine, "1.00 SKYT fee, included in what you pay.");
    assert.equal(hundred.preSign, "You're about to sign");
    assert.equal(hundred.triggerLine, "Trigger ≥ 69 mm");
    assert.doesNotMatch(hundred.feeLine ?? "", /%/);
    assert.doesNotMatch(JSON.stringify(hundred), /insurance/i);
    assert.equal(stakeSheetForCover({ ...base, city: "New York", coverSkyt: 100 })?.placeLine, "New York · Central Park · Oct 26 – Nov 2 (UTC)");

    assert.equal(stakeSheetForCover({ ...base, coverSkyt: 50 })?.payLine, "You pay 12.00 SKYT");
    assert.equal(stakeSheetForCover({ ...base, coverSkyt: 50 })?.feeLine, "0.50 SKYT fee, included in what you pay.");
    assert.equal(stakeSheetForCover({ ...base, coverSkyt: 250 })?.payLine, "You pay 60.00 SKYT");
    assert.equal(stakeSheetForCover({ ...base, coverSkyt: 250 })?.getLine, "You get 250 SKYT");
    assert.equal(stakeSheetForCover({ ...base, coverSkyt: 250 })?.multiple, "4.1×");
    assert.deepEqual(COVER_CHIPS.map((chip) => stakeSheetForCover({ ...base, coverSkyt: chip })?.premiumLabel), ["12.00", "24.00", "60.00"]);
  });

  it("prints the live quote fee and omits the line when the quote has none", () => {
    const overridden = stakeSheetForCover({ ...base, coverSkyt: 100, protocolFeeBase: "2500000" });
    assert.equal(overridden?.feeLine, "2.50 SKYT fee, included in what you pay.");
    const unquoted = stakeSheetForCover({ ...base, coverSkyt: 100, inputsHash: null, protocolFeeBase: null });
    assert.equal(unquoted?.payLine, "You pay 24.00 SKYT");
    assert.equal(unquoted?.feeLine, null);
    assert.equal(stakeSheetForCover({ ...base, station: null, coverSkyt: 100 }), null);
  });

  it("names the protect button from the premium, or the disabled reason", () => {
    assert.deepEqual(protectButtonLabel({ connected: true, premiumLabel: "24.00", triggerChosen: true }), { label: "Protect for 24.00 SKYT", disabled: false, action: "protect" });
    assert.equal(protectButtonLabel({ connected: false, premiumLabel: "24.00", triggerChosen: true }).label, "Connect wallet to protect");
    assert.equal(protectButtonLabel({ connected: true, premiumLabel: null, triggerChosen: false }).label, "Pick a trigger");
  });
});

describe("market status mapping", () => {
  it("uses Open, a real Opens date, or Closed, and never green or a leading dot", () => {
    const now = Date.parse("2026-10-19T00:00:00Z") / 1000;
    const open = marketStatus([{ salesCloseAt: now + 100, observationStart: now - 10 }], now);
    const opens = marketStatus([{ salesCloseAt: null, observationStart: Date.parse("2026-11-02T00:00:00Z") / 1000 }], now);
    const closed = marketStatus([{ salesCloseAt: now - 10, observationStart: now - 100 }], now);
    assert.equal(open?.label, "Open");
    assert.equal(marketStatusInk(open!.tone), "glacier");
    assert.equal(opens?.label, "Opens Nov 2");
    assert.equal(marketStatusInk(opens!.tone), "neutral");
    assert.equal(closed?.label, "Closed");
    assert.equal(marketStatusInk(closed!.tone), "muted");
    for (const status of [open, opens, closed]) {
      assert.ok(status);
      assert.equal(/^[\s•·.]/.test(status.label), false);
      assert.notEqual(marketStatusInk(status.tone), "green");
    }
  });
});

describe("trigger ladder states", () => {
  const rows = triggerRows({
    totalsMm: [4, 8, 12, 18, 29, 40, 55, 69, 102, 166],
    forecastCumulativeMm: null,
    onChainThresholdMm: 69,
    onChainProbabilityBps: 2_000,
    onChainPremiumRateBps: 2_400,
  });

  it("labels priced ticks with chance, mutes the rest as soon, and selects one yellow tick", () => {
    const ticks = ladderTicks(rows, 69);
    const priced = ticks.filter((tick) => tick.tappable);
    const soon = ticks.filter((tick) => tick.state === "soon");
    assert.equal(priced.length, 1);
    assert.equal(priced[0]?.label, "≥ 69 mm · 20.0%");
    assert.equal(priced[0]?.state, "selected");
    assert.ok(soon.length > 0);
    assert.ok(soon.every((tick) => tick.label.endsWith("· soon") && tick.tappable === false));
    assert.equal(ladderTicks(rows, null).find((tick) => tick.thresholdMm === 69)?.state, "priced");
  });
});

describe("covered receipt rows", () => {
  it("uses cover, paid, and the pays line from the position", () => {
    const rows = coveredReceiptRows({ premiumPaid: "24000000", coverAmount: "100000000", trigger: "≥ 69 mm", windowLabel: WINDOW, windowStart: "Oct 26 (UTC)" });
    assert.deepEqual(rows.map((row) => [row.label, row.value, row.payout]), [
      ["Cover", "100 SKYT", false],
      ["Paid", "24.00 SKYT", false],
      ["Pays", "100 SKYT if ≥ 69 mm", true],
      ["Counting starts", "Oct 26", false],
    ]);
  });

  it("prints observed millimetres only when the reading exists", () => {
    const rows = coveredReceiptRows({ premiumPaid: "24000000", coverAmount: "100000000", trigger: "≥ 69 mm", observedMm: 12, openedAt: "Oct 20" });
    assert.equal(rows.find((row) => row.label === "So far")?.value, "12 mm");
    assert.equal(rows.find((row) => row.label === "Opened")?.value, "Oct 20");
    assert.equal(rows.some((row) => row.label === "Counting starts"), false);
  });

  it("replaces the start date with the close once the window has paid out", () => {
    const rows = coveredReceiptRows({ premiumPaid: "24000000", coverAmount: "100000000", trigger: "≥ 69 mm", windowLabel: WINDOW, windowStart: "Oct 26 (UTC)", windowEnd: "Nov 2 (UTC)", paidOut: true });
    assert.equal(rows.some((row) => row.label === "Counting starts"), false);
    assert.deepEqual(rows.find((row) => row.label === "Closed"), { label: "Closed", value: "Nov 2 · paid", payout: false });
    const fromLabel = coveredReceiptRows({ premiumPaid: "24000000", coverAmount: "100000000", trigger: "≥ 69 mm", windowLabel: WINDOW, paidOut: true });
    assert.equal(fromLabel.find((row) => row.label === "Closed")?.value, "Nov 2 · paid");
  });
});

describe("window stamps", () => {
  it("stamps paid out in slicker copy and dry week or dry month without inventing a total", () => {
    assert.equal(windowStamp({ closed: false, paidOut: true, payoutLabel: "100", observedMm: 80, triggerMm: 69, monthly: false }), null);
    assert.deepEqual(windowStamp({ closed: true, paidOut: true, payoutLabel: "100", observedMm: 80, triggerMm: 69, monthly: false }), {
      tone: "paid",
      title: "Paid out · 100 SKYT",
      subline: "It rained. You're paid.",
    });
    assert.deepEqual(windowStamp({ closed: true, paidOut: false, payoutLabel: "100", observedMm: 12, triggerMm: 69, monthly: false }), {
      tone: "dry",
      title: "Dry week · 12 of 69 mm",
      subline: "No payout. Your plans stayed dry.",
    });
    assert.equal(windowStamp({ closed: true, paidOut: false, payoutLabel: "100", observedMm: 4, triggerMm: 40, monthly: true })?.title, "Dry month · 4 of 40 mm");
    assert.equal(windowStamp({ closed: true, paidOut: false, payoutLabel: "100", observedMm: null, triggerMm: 69, monthly: false }), null);
    assert.equal(windowStamp({ closed: true, paidOut: true, payoutLabel: null, observedMm: 80, triggerMm: 69, monthly: false }), null);
  });
});

describe("gauge tick anchor", () => {
  it("centres the chip on the trigger and keeps it inside the tube", () => {
    const top = gaugeTickOffset(69, 86.25, 168, 48);
    const centre = top + 24;
    const y = 148 - 128 * (69 / 86.25);
    assert.ok(Math.abs(centre - y) < 1);
    assert.ok(top >= 0 && top <= 168 - 48);
    assert.equal(gaugeTickOffset(Number.NaN, 86, 168, 48), 0);
    assert.equal(protectGaugeHeight(1024), 168);
    assert.equal(protectGaugeHeight(800), 144);
    assert.equal(protectGaugeHeight(700), 128);
    assert.equal(ladderLabelFontSize(168), 14);
    assert.ok(Math.abs(ladderLabelFontSize(144) * (144 / 168) - 14) < 0.01);
    assert.ok(Math.abs(ladderLabelFontSize(128) * (128 / 168) - 14) < 0.01);
    assert.equal(ladderLabelFontSize(0), 14);
  });
});

describe("gauge water", () => {
  it("stays empty without a reading and follows observed millimetres", () => {
    assert.equal(gaugeWaterLevel({ observedMm: null, maxMm: 86.25, triggerMm: 69 }), 0);
    assert.equal(gaugeWaterLevel({ observedMm: 12, maxMm: 86.25, triggerMm: 69 }).toFixed(2), (12 / 86.25).toFixed(2));
    const paid = gaugeWaterLevel({ observedMm: null, maxMm: 86.25, triggerMm: 69, paidOut: true });
    assert.ok(paid > 69 / 86.25 && paid < 1);
    assert.equal(WALLET_CHAIN_ERROR, "Can't read Devnet right now. Nothing is shown until it's back. Try again in a minute.");
    assert.match(HOW_IT_SETTLES, /WeatherXM is context only/);
  });
});

describe("market rows", () => {
  it("keeps the multiple on its own figures line and gives unopened cities a dry status", () => {
    const open = marketRowModel({ slug: "new-york", stationSource: "NOAA Central Park", open: true, tenor: "weekly", expiry: "Nov 2", triggerMm: 69, multiple: "4.1×", probabilityBps: 2_000 });
    assert.equal(open.stationLine, "Central Park · weekly to Nov 2");
    assert.equal(open.figures, "≥69 mm  4.1×");
    assert.equal(open.status, "Open");
    const chicago = marketRowModel({ slug: "chicago", stationSource: "NOAA O'Hare", open: false, tenor: null, expiry: null, triggerMm: null, multiple: null, probabilityBps: null });
    assert.equal(chicago.stationLine, "O'Hare");
    assert.equal(chicago.status, "Not open yet");
    assert.equal(chicago.ink, "dry");
    const toronto = marketRowModel({ slug: "toronto", stationSource: "Environment Canada", open: false, tenor: null, expiry: null, triggerMm: null, multiple: null, probabilityBps: null });
    assert.equal(toronto.status, "Waiting on Environment Canada data");
    assert.equal(moreTriggersSoon(5), "5 more triggers soon");
    assert.equal(moreTriggersSoon(0), null);
  });
});
