import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buyPhaseLabel, describeChainError, TransactionFailedError, visibleTransactionError } from "./buy-phase.ts";

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
});
