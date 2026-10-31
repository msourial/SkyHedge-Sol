export function walletConnectionError(reason: unknown): string {
  const detail = reason instanceof Error ? reason.message : "";
  return /cancel|reject|declin/i.test(detail)
    ? "Wallet connection wasn’t approved. You can try again whenever you’re ready."
    : "The wallet didn’t connect. Check that a compatible Solana wallet is installed, then try again.";
}
