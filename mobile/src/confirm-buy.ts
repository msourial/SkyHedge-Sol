/** Primary action on the Protect confirm sheet. Starts the wallet signing path. */
export function handleConfirmApprove(input: { close: () => void; signOpenPosition: () => void }): void {
  input.close();
  input.signOpenPosition();
}

export function approveInPhantomLabel(pay: string): string {
  return `Approve in Phantom · pay ${pay} SKYT`;
}
