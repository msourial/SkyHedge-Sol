/** Customer-facing prepare error. The raw RPC or program text stays in detail. */
export function prepareFailure(error: unknown): { message: string; detail: string } {
  const detail = error instanceof Error ? error.message : String(error ?? "");
  if (/429|too many requests|rate limit|timed out|timeout|ECONNRESET|socket hang up/i.test(detail)) {
    return { message: "Devnet is busy, try again", detail };
  }
  if (/sales window is closed|position opening window closed|sales window has ended/i.test(detail)) {
    return { message: "This window just closed", detail };
  }
  if (/could not find account|account does not exist|no associated token/i.test(detail)) {
    return { message: "A required Devnet account is missing", detail };
  }
  if (/could not be prepared from finalized Devnet state/i.test(detail)) {
    return { message: "Devnet is busy, try again", detail };
  }
  const message = detail.split("\n").map((line) => line.trim()).find((line) => line && !/^at /.test(line)) ?? "The protection could not be prepared.";
  return { message, detail };
}
