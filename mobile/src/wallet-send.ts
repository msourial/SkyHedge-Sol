/** Phantom requires a numeric minContextSlot on sol_mwa_sign_and_send_transactions. */
export function buildSignAndSendParams<T>(transactions: T[], minContextSlot: number) {
  if (!Number.isInteger(minContextSlot) || minContextSlot < 0) {
    throw new Error("Could not read a recent Devnet slot. Check your connection and try again.");
  }
  return { transactions, minContextSlot, commitment: "finalized" as const };
}
