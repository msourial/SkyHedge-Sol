import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buyPhaseLabel, customerPrepareError, describeChainError, TransactionFailedError, visibleTransactionError } from "./buy-phase.ts";

describe("buy phase copy", () => {
  it("names each step the customer sees after tapping protect", () => {
    assert.equal(buyPhaseLabel("waiting"), "Waiting for approval");
    assert.equal(buyPhaseLabel("sending"), "Sending");
    assert.equal(buyPhaseLabel("confirmed"), "Confirmed");
    assert.equal(buyPhaseLabel("failed"), "Failed");
  });

  it("keeps the program error from a finalized transaction", () => {
    const message = describeChainError({ InstructionError: [0, { Custom: 6008 }] });
    assert.equal(message, "Insufficient liquidity (6008)");
    const failed = new TransactionFailedError(message, "sig");
    assert.equal(failed.signature, "sig");
    assert.equal(visibleTransactionError(failed.message), message);
  });

  it("shows a busy Devnet instead of the generic prepare line, and keeps the RPC text", () => {
    const shown = customerPrepareError("The unsigned transaction could not be prepared from finalized Devnet state.");
    assert.equal(shown.message, "Devnet is busy, try again");
    assert.match(shown.detail ?? "", /finalized Devnet state/);
    const closed = customerPrepareError("This window just closed", "That city window’s sales window is closed.");
    assert.equal(closed.message, "This window just closed");
    assert.match(closed.detail ?? "", /sales window is closed/);
  });
});

describe("wallet failures on the Failed card", () => {
  it("names Phantom, not Devnet, when Phantom never answers, and keeps the raw error in Details", async () => {
    const { transactionFailure, PHANTOM_NO_ANSWER } = await import("./buy-phase.ts");
    const raw = "java.util.concurrent.TimeoutException: Timed out waiting for response with id=2";
    assert.deepEqual(transactionFailure(raw, null), { message: PHANTOM_NO_ANSWER, detail: raw });
  });
  it("still maps a rate-limited prepare to Devnet is busy", async () => {
    const { transactionFailure } = await import("./buy-phase.ts");
    assert.equal(transactionFailure("Devnet is busy, try again", "failed to get recent blockhash: 429 Too Many Requests").message, "Devnet is busy, try again");
  });
});
