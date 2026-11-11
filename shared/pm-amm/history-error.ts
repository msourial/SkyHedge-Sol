/** User-facing history errors; never dump raw RPC bodies. */
export function publicHistoryError(error: unknown): string {
  const message=error instanceof Error?error.message:String(error);
  if(/429|too many requests|rate limit/i.test(message))return 'Devnet is busy right now. Retry to read this data.';
  return message;
}
