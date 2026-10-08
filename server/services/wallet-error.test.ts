import { strict as assert } from "node:assert";
import { WalletConnectionError, WalletSendTransactionError } from "@solana/wallet-adapter-base";
import { walletErrorMessage } from "../../client/src/lib/wallet-error";

describe("wallet error messages", () => {
  it("identifies a failed transaction instead of calling it a connection failure", () => {
    assert.match(walletErrorMessage(new WalletSendTransactionError("Unexpected error")), /transaction/i);
    assert.doesNotMatch(walletErrorMessage(new WalletSendTransactionError("Unexpected error")), /could not connect/i);
  });

  it("distinguishes rejected transaction approval from a connection rejection", () => {
    assert.match(walletErrorMessage(new WalletSendTransactionError("User rejected the request")), /transaction approval was rejected/i);
    assert.match(walletErrorMessage(new WalletConnectionError("User rejected the request")), /connection was rejected/i);
  });
});
