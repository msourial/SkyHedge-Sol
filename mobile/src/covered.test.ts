import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coveredLead, coveredRows, findPositionAfterBuy, isExistingPositionError, isWalletDecline, positionForWindow } from "./covered.ts";
import { duplicatePositionReason } from "./protection.ts";
import type { ChainProtection } from "./positions.ts";

const NY_WEEKLY = "4MVypmwGhpNTvLhpEUTPu6AHEXL5aRzuprkPWT9o6ygq";
const position: ChainProtection = {
  market: NY_WEEKLY,
  address: "8WtqsX2qbKDCrwoyc273NKa41yAqGqKNzU58mPWQwrR8",
  protectedAmount: "100000000",
  premiumPaid: "24000000",
  potentialPayout: "100000000",
  city: "New York",
  windowLabel: "Oct 26 – Nov 2 (UTC)",
  triggerLabel: "≥ 69 mm",
  statusLabel: "Active",
  openedAt: 1792592351,
  explorerUrl: "https://explorer.solana.com/address/8WtqsX2qbKDCrwoyc273NKa41yAqGqKNzU58mPWQwrR8?cluster=devnet",
};
const other: ChainProtection = { ...position, market: "OtherWindow1111111111111111111111111111111", address: "x" };

describe("covered state", () => {
  it("matches the position for the selected window only", () => {
    assert.equal(positionForWindow([other, position], NY_WEEKLY), position);
    assert.equal(positionForWindow([other], NY_WEEKLY), null);
    assert.equal(positionForWindow(null, NY_WEEKLY), null);
    assert.equal(positionForWindow([position], null), null);
  });

  it("recognises the app's duplicate gate and the program's account-in-use refusal", () => {
    assert.ok(isExistingPositionError(duplicatePositionReason("New York", "pending")));
    assert.ok(isExistingPositionError("Allocate: account Address { 8Wtq… } already in use"));
    assert.ok(!isExistingPositionError("Devnet is busy. Try again."));
    assert.ok(!isExistingPositionError(null));
  });

  it("treats a wallet decline as nothing signed", () => {
    assert.ok(isWalletDecline("You declined the request in Phantom. Nothing was sent."));
    assert.ok(!isWalletDecline("Transaction was not confirmed in 60.00 seconds"));
  });

  it("finds a position that lands on a later finalized read", async () => {
    let calls = 0;
    const slept: number[] = [];
    const result = await findPositionAfterBuy({
      windowAddress: NY_WEEKLY,
      read: async () => { calls++; if (calls === 1) throw new Error("429"); return calls < 3 ? [] : [position]; },
      sleep: async (ms) => { slept.push(ms); },
      delayMs: 10,
    });
    assert.equal(result.position, position);
    assert.equal(calls, 3);
    assert.deepEqual(slept, [10, 10]);
  });

  it("reports no position after the attempts run out", async () => {
    const result = await findPositionAfterBuy({ windowAddress: NY_WEEKLY, read: async () => [other], sleep: async () => {}, attempts: 2 });
    assert.equal(result.position, null);
    assert.deepEqual(result.protections, [other]);
  });

  it("shows only values read from the position account", () => {
    const rows = coveredRows(position);
    assert.deepEqual(rows.map((row) => [row.label, row.value]), [
      ["Covered", "100 SKYT"],
      ["Paid", "24.00 SKYT"],
      ["Payout if triggered", "100 SKYT"],
      ["Window", "Oct 26 – Nov 2 (UTC)"],
      ["Trigger", "≥ 69 mm cumulative"],
      ["Status", "Active"],
      ["Opened", "Oct 21, 14:19 UTC"],
    ]);
    assert.match(coveredLead(position), /New York protection on this window/);
    assert.doesNotMatch(JSON.stringify(rows) + coveredLead(position), /insurance/i);
  });
});
