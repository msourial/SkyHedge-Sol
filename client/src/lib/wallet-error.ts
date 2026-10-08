import type { WalletError } from "@solana/wallet-adapter-base";

export function walletErrorMessage(error: Pick<WalletError, "name" | "message">): string {
  const rejected = /reject|declin|cancel/i.test(`${error.name} ${error.message}`);
  const transaction = /Wallet(Send|Sign)TransactionError/.test(error.name) || /transaction/i.test(error.message);
  if (transaction) return rejected
    ? "Transaction approval was rejected. No transaction was submitted."
    : "The wallet could not confirm this transaction. Check wallet activity or Solana Explorer before retrying.";
  if (rejected) return "Wallet connection was rejected. Nothing was submitted.";
  if (/Wallet(Connection|NotReady|NotConnected)Error/.test(error.name)) {
    return "The wallet could not connect. Confirm the extension is unlocked and try again.";
  }
  return "The wallet reported an error. Check the wallet and try again.";
}
