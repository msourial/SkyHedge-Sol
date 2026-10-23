import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { marketStatus } from "../../shared/pay-get.ts";
import { COVER_CHIPS, coveredReceiptRows, ladderTicks, marketStatusInk, protectButtonLabel, stakeSheetForCover, stationDisplayName } from "../../shared/protect-copy.ts";
import { triggerRows } from "../../shared/window-chain.ts";

const HASH = "ab".repeat(32);
const WINDOW = "Oct 26 – Nov 2 (UTC)";

describe("stake sheet math", () => {
  const base = { probabilityBps: 2_000, premiumRateBps: 2_400, inputsHash: HASH, station: stationDisplayName("NOAA Central Park"), triggerMm: 69, windowLabel: WINDOW };

  it("prices each cover chip from the quote, including the protocol fee field", () => {
    const hundred = stakeSheetForCover({ ...base, coverSkyt: 100 });
    assert.ok(hundred);
    assert.equal(hundred.payLine, "You pay 24.00 SKYT");
    assert.equal(hundred.getLine, "You get 100 SKYT if Central Park hits ≥ 69 mm, Oct 26 – Nov 2 (UTC)");
    assert.equal(hundred.multiple, "4.1×");
    assert.equal(hundred.feeLine, "Includes 1.00 SKYT protocol fee");
    assert.equal(hundred.preSign, "You'll sign: pay 24.00 SKYT · cover 100 SKYT · Central Park ≥ 69 mm · Oct 26 – Nov 2 (UTC)");
    assert.doesNotMatch(hundred.feeLine ?? "", /%/);
    assert.doesNotMatch(JSON.stringify(hundred), /insurance/i);

    assert.equal(stakeSheetForCover({ ...base, coverSkyt: 50 })?.payLine, "You pay 12.00 SKYT");
    assert.equal(stakeSheetForCover({ ...base, coverSkyt: 50 })?.feeLine, "Includes 0.50 SKYT protocol fee");
    assert.equal(stakeSheetForCover({ ...base, coverSkyt: 250 })?.payLine, "You pay 60.00 SKYT");
    assert.equal(stakeSheetForCover({ ...base, coverSkyt: 250 })?.getLine, "You get 250 SKYT if Central Park hits ≥ 69 mm, Oct 26 – Nov 2 (UTC)");
    assert.equal(stakeSheetForCover({ ...base, coverSkyt: 250 })?.multiple, "4.1×");
    assert.deepEqual(COVER_CHIPS.map((chip) => stakeSheetForCover({ ...base, coverSkyt: chip })?.premiumLabel), ["12.00", "24.00", "60.00"]);
  });

  it("prints the live quote fee and omits the line when the quote has none", () => {
    const overridden = stakeSheetForCover({ ...base, coverSkyt: 100, protocolFeeBase: "2500000" });
    assert.equal(overridden?.feeLine, "Includes 2.50 SKYT protocol fee");
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
  it("uses paid, cover, trigger, and window from the position", () => {
    const rows = coveredReceiptRows({ premiumPaid: "24000000", coverAmount: "100000000", trigger: "≥ 69 mm", windowLabel: WINDOW });
    assert.deepEqual(rows.map((row) => [row.label, row.value]), [
      ["Paid", "24.00 SKYT"],
      ["Cover", "100 SKYT"],
      ["Trigger", "≥ 69 mm"],
      ["Window", WINDOW],
    ]);
    assert.equal(rows[1]?.payout, true);
    assert.equal(rows[2]?.payout, true);
  });
});
