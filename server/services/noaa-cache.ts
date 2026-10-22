import { getCache } from "@vercel/functions";
import { NoaaRainfallProvider, type DailyRainfall, type RainfallProvider, type SkyHedgeCity } from "./noaa.js";

/**
 * Pricing reads observed daily rainfall for past windows (ten prior years plus a completed sample window),
 * which NOAA does not revise minute to minute, so an hour is safe and outlives idle instances. The NWS
 * forecast grid updates roughly hourly; keep it short. Settlement never uses this cache.
 */
export const NOAA_DAILY_CACHE_TTL_S = 60 * 60;
export const NOAA_FORECAST_CACHE_TTL_S = 5 * 60;
/** A shared-cache lookup may not hold up a NOAA read for longer than this. */
const SHARED_CACHE_BUDGET_MS = 400;

export interface SharedCache {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, options?: { ttl?: number; name?: string }): Promise<void>;
}

/** Vercel Runtime Cache when deployed (shared across instances in a region); none elsewhere. */
function defaultSharedCache(): SharedCache | null {
  if (!process.env.VERCEL) return null;
  try { return getCache({ namespace: "noaa-v1" }); } catch { return null; }
}

function within<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    work.then((value) => { clearTimeout(timer); resolve(value); }, () => { clearTimeout(timer); resolve(fallback); });
  });
}

/**
 * Shares one in-flight read per key and keeps successful results briefly, in memory and (on Vercel) in the
 * Runtime Cache. Failures are never cached. Only for quote/status reads, never settlement.
 */
export class NoaaReadCache {
  private readonly memory = new Map<string, { expiresAt: number; value: unknown }>();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly shared: SharedCache | null = defaultSharedCache(),
    private readonly now: () => number = Date.now,
  ) {}

  read<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    const hit = this.memory.get(key);
    if (hit && hit.expiresAt > this.now()) return Promise.resolve(hit.value as T);
    if (hit) this.memory.delete(key);
    const pending = this.inFlight.get(key);
    if (pending) return pending as Promise<T>;
    const run = (async () => {
      if (this.shared) {
        const stored = await within(this.shared.get(key), SHARED_CACHE_BUDGET_MS, null);
        if (stored != null) {
          this.memory.set(key, { value: stored, expiresAt: this.now() + ttlSeconds * 1_000 });
          return stored as T;
        }
      }
      const value = await load();
      this.memory.set(key, { value, expiresAt: this.now() + ttlSeconds * 1_000 });
      if (this.shared) void this.shared.set(key, value, { ttl: ttlSeconds, name: key }).catch(() => {});
      return value;
    })();
    this.inFlight.set(key, run);
    const clear = () => { if (this.inFlight.get(key) === run) this.inFlight.delete(key); };
    run.then(clear, clear);
    return run;
  }
}

const processCache = new NoaaReadCache();

/** NOAA provider for pricing and status reads: deduped and briefly cached. Settlement keeps the uncached provider. */
export class CachedNoaaRainfallProvider implements RainfallProvider {
  readonly name = "NOAA" as const;
  constructor(
    private readonly inner: RainfallProvider = new NoaaRainfallProvider(),
    private readonly cache: NoaaReadCache = processCache,
  ) {}

  dailyRainfall(stationId: string, start: string, end: string): Promise<DailyRainfall[]> {
    return this.cache.read(`daily:${stationId}:${start}:${end}`, NOAA_DAILY_CACHE_TTL_S, () => this.inner.dailyRainfall(stationId, start, end));
  }

  forecastRainfall(city: SkyHedgeCity, start: string, end: string): Promise<DailyRainfall[]> {
    return this.cache.read(`forecast:${city}:${start}:${end}`, NOAA_FORECAST_CACHE_TTL_S, () => this.inner.forecastRainfall(city, start, end));
  }
}
