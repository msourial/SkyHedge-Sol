export function walletConnectionError(reason: unknown): string {
  const detail = reason instanceof Error ? reason.message : "";
  if (/cancel|reject|declin/i.test(detail)) return "Phantom connection wasn’t approved. You can try again.";
  if (/Install the Phantom/.test(detail)) return detail;
  return "Phantom didn’t connect. Unlock the browser extension and try again.";
}
