/** Maps raw Java/network/RPC errors to user-facing copy. Never surface stack text or hostnames. */
const NETWORK = /unknownhost|unable to resolve host|network request failed|fetch failed|failed to fetch|cleartext|timed? ?out|timeout|econn|enotfound|socket|java\.net|ssl/i;

export function isNetworkError(message: string | null | undefined): boolean {
  return !!message && NETWORK.test(message);
}

export function friendlyError(message: string | null | undefined, fallback = "Something went wrong. Try again."): string {
  if (!message) return fallback;
  if (isNetworkError(message)) return "You're offline or SkyHedge can't be reached. Check your connection and try again.";
  if (/user rejected|declined|cancell?ed by user/i.test(message)) return "You declined the request in your wallet. Nothing was sent.";
  if (/insufficient/i.test(message)) return "Your wallet doesn't have enough SKYT or SOL for this.";
  if (message === "NOT_FOUND" || message === "DATA_UNAVAILABLE") return "Station data for this window isn't published yet.";
  if (/exception|error:|\bat [\w.$]+\(|^\w+(\.\w+)+:/i.test(message) || message.length > 160) return fallback;
  return message;
}

/** Hide raw station identifiers like GHCND:USW00014933 behind a human label. */
export function stationLabel(id: string | null | undefined): string {
  if (!id) return "Station pending";
  if (/USW00014933/.test(id)) return "Des Moines Intl Airport";
  if (/6158731/.test(id)) return "Toronto Pearson";
  return "Official weather station";
}
