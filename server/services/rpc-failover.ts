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
/**
 * The first (preferred) endpoint gets a longer budget: a cold Vercel instance needs several seconds for its
 * first multi-call read, and cutting it at 3s only pushes the request onto rate-limited public fallbacks.
 */
export const RPC_PRIMARY_ATTEMPT_TIMEOUT_MS = 8_000;
/** One fallback RPC attempt may not outlive this. */
export const RPC_ATTEMPT_TIMEOUT_MS = 3_000;
/** The whole failover, retries included, may not outlive this (primary 8s + two 3s fallbacks + backoff). */
export const RPC_FAILOVER_DEADLINE_MS = 15_000;

export const RPC_RATE_LIMITED_CODE = "RATE_LIMITED";
export const RPC_RATE_LIMITED_MESSAGE = "Devnet RPC is rate-limited. Try again shortly.";

export class RpcRateLimitedError extends Error {
  readonly code = RPC_RATE_LIMITED_CODE;
  constructor(message = RPC_RATE_LIMITED_MESSAGE) {
    super(message);
    this.name = "RpcRateLimitedError";
  }
}

export function isRpcRateLimited(error: unknown): boolean {
  if (error instanceof RpcRateLimitedError) return true;
  if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === RPC_RATE_LIMITED_CODE) return true;
  const message = error instanceof Error ? error.message : String(error);
  const status = error && typeof error === "object" && "status" in error ? Number((error as { status?: unknown }).status) : 0;
  return status === 429 || /\b429\b|too many requests|rate limit|max usage reached/i.test(message);
}

export function isPublicDevnetRpcUrl(url: string): boolean {
  return (PUBLIC_DEVNET_RPC_URLS as readonly string[]).includes(url.replace(/\/$/, ""));
}

export function hasPrivateRpcUrl(envUrl = process.env.SOLANA_RPC_URL): boolean {
  return Boolean(envUrl) && !isPublicDevnetRpcUrl(envUrl);
}

export function rpcRateLimitedBody(): { error: string; message: string } {
  return { error: RPC_RATE_LIMITED_CODE, message: RPC_RATE_LIMITED_MESSAGE };
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
    /** Per-attempt budget for urls[0]. */
    primaryTimeoutMs?: number;
    /** Per-attempt budget for fallback urls. */
    timeoutMs?: number;
    deadlineMs?: number;
    backoffMs?: readonly number[];
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
  } = {},
): Promise<T> {
  if (urls.length === 0) throw new Error("No Devnet RPC endpoints configured.");
  const timeoutMs = options.timeoutMs ?? RPC_ATTEMPT_TIMEOUT_MS;
  const primaryTimeoutMs = options.primaryTimeoutMs ?? RPC_PRIMARY_ATTEMPT_TIMEOUT_MS;
  const deadlineMs = options.deadlineMs ?? RPC_FAILOVER_DEADLINE_MS;
  const backoffMs = options.backoffMs ?? RPC_RATE_LIMIT_BACKOFF_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const deadlineAt = now() + deadlineMs;
  let last: unknown = new Error("Devnet status is unavailable.");

  for (let index = 0; index < urls.length; index++) {
    const url = urls[index]!;
    // A private keyed URL that is already 429 should not be retried or failed over:
    // retries re-run the whole multi-call read and burn remaining quota.
    const privatePrimary = index === 0 && !isPublicDevnetRpcUrl(url);
    const tries = index === 0 && !privatePrimary ? backoffMs.length + 1 : 1;
    for (let attempt = 0; attempt < tries; attempt++) {
      const remaining = deadlineAt - now();
      if (remaining <= 0) throw last instanceof Error ? last : new Error("Devnet RPC timed out");
      try {
        const budget = index === 0 ? primaryTimeoutMs : timeoutMs;
        return await withTimeout(call(url), Math.min(budget, remaining));
      } catch (error) {
        last = error;
        if (privatePrimary && isRpcRateLimited(error)) throw error;
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
