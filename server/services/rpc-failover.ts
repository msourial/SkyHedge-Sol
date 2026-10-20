export const PUBLIC_DEVNET_RPC_URLS = [
  "https://api.devnet.solana.com",
  "https://solana-devnet.api.onfinality.io/public",
] as const;

/**
 * A private SOLANA_RPC_URL (e.g. a keyed Helius Devnet URL) goes first: public Devnet RPCs rate-limit
 * the shared Vercel IPs (HTTP 429). With no override, or a public one, official Devnet stays first.
 */
export function prepareRpcUrls(envUrl = process.env.SOLANA_RPC_URL): string[] {
  const isPublic = !envUrl || (PUBLIC_DEVNET_RPC_URLS as readonly string[]).includes(envUrl.replace(/\/$/, ""));
  const ordered = isPublic ? [PUBLIC_DEVNET_RPC_URLS[0], envUrl, PUBLIC_DEVNET_RPC_URLS[1]] : [envUrl, ...PUBLIC_DEVNET_RPC_URLS];
  return [...new Set(ordered.filter((url): url is string => Boolean(url)))];
}

/** First URL is retried on HTTP 429. Later URLs are single-shot fallbacks. */
export const RPC_RATE_LIMIT_BACKOFF_MS = [250, 750] as const;
/** One RPC attempt may not outlive this. */
export const RPC_ATTEMPT_TIMEOUT_MS = 3_000;
/** The whole failover, retries included, may not outlive this. */
export const RPC_FAILOVER_DEADLINE_MS = 8_000;

export function isRpcRateLimited(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b429\b|too many requests|rate limit/i.test(message);
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Devnet RPC timed out")), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function callWithRpcFailover<T>(
  urls: readonly string[],
  call: (url: string) => Promise<T>,
  options: {
    timeoutMs?: number;
    deadlineMs?: number;
    backoffMs?: readonly number[];
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
  } = {},
): Promise<T> {
  if (urls.length === 0) throw new Error("No Devnet RPC endpoints configured.");
  const timeoutMs = options.timeoutMs ?? RPC_ATTEMPT_TIMEOUT_MS;
  const deadlineMs = options.deadlineMs ?? RPC_FAILOVER_DEADLINE_MS;
  const backoffMs = options.backoffMs ?? RPC_RATE_LIMIT_BACKOFF_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const deadlineAt = now() + deadlineMs;
  let last: unknown = new Error("Devnet status is unavailable.");

  for (let index = 0; index < urls.length; index++) {
    const url = urls[index]!;
    const tries = index === 0 ? backoffMs.length + 1 : 1;
    for (let attempt = 0; attempt < tries; attempt++) {
      const remaining = deadlineAt - now();
      if (remaining <= 0) throw last instanceof Error ? last : new Error("Devnet RPC timed out");
      try {
        return await withTimeout(call(url), Math.min(timeoutMs, remaining));
      } catch (error) {
        last = error;
        const retryHere = index === 0 && attempt < tries - 1 && isRpcRateLimited(error);
        if (!retryHere) break;
        const wait = Math.min(backoffMs[attempt] ?? 0, Math.max(0, deadlineAt - now()));
        if (wait <= 0) break;
        await sleep(wait);
      }
    }
  }

  throw last instanceof Error ? last : new Error("Devnet status is unavailable.");
}
