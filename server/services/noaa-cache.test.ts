import { expect } from "chai";
import { CachedNoaaRainfallProvider, NoaaReadCache, NOAA_DAILY_CACHE_TTL_S, type SharedCache } from "./noaa-cache";
import type { DailyRainfall, RainfallProvider } from "./noaa";

const rows: DailyRainfall[] = [{ date: "2026-10-01", millimeters: 3.2 }];

function fakeProvider(impl?: () => Promise<DailyRainfall[]>) {
  const calls = { daily: 0, forecast: 0 };
  const provider: RainfallProvider = {
    name: "NOAA",
    async dailyRainfall() { calls.daily += 1; return impl ? impl() : rows; },
    async forecastRainfall() { calls.forecast += 1; return impl ? impl() : rows; },
  };
  return { provider, calls };
}

function memoryShared() {
  const store = new Map<string, unknown>();
  const shared: SharedCache & { store: Map<string, unknown>; sets: Array<{ key: string; ttl?: number }> } = {
    store,
    sets: [],
    async get(key) { return store.get(key) ?? null; },
    async set(key, value, options) { store.set(key, value); shared.sets.push({ key, ttl: options?.ttl }); },
  };
  return shared;
}

describe("NOAA read cache", () => {
  it("shares one in-flight read between concurrent callers", async () => {
    let release!: (value: DailyRainfall[]) => void;
    const { provider, calls } = fakeProvider(() => new Promise((resolve) => { release = resolve; }));
    const cached = new CachedNoaaRainfallProvider(provider, new NoaaReadCache(null));
    const a = cached.dailyRainfall("GHCND:X", "2026-10-01", "2026-10-07");
    const b = cached.dailyRainfall("GHCND:X", "2026-10-01", "2026-10-07");
    await new Promise((resolve) => setImmediate(resolve));
    release(rows);
    expect(await a).to.deep.equal(rows);
    expect(await b).to.deep.equal(rows);
    expect(calls.daily).to.equal(1);
  });

  it("serves a success from memory until the TTL passes, then reads again", async () => {
    let clock = 0;
    const { provider, calls } = fakeProvider();
    const cached = new CachedNoaaRainfallProvider(provider, new NoaaReadCache(null, () => clock));
    await cached.forecastRainfall("new-york", "2026-10-26", "2026-11-02");
    await cached.forecastRainfall("new-york", "2026-10-26", "2026-11-02");
    expect(calls.forecast).to.equal(1);
    clock += 6 * 60_000;
    await cached.forecastRainfall("new-york", "2026-10-26", "2026-11-02");
    expect(calls.forecast).to.equal(2);
  });

  it("never caches a failure", async () => {
    let fail = true;
    const { provider, calls } = fakeProvider(async () => { if (fail) throw new Error("NOAA station observations unavailable (503)"); return rows; });
    const shared = memoryShared();
    const cached = new CachedNoaaRainfallProvider(provider, new NoaaReadCache(shared));
    let message = "";
    try { await cached.dailyRainfall("GHCND:X", "a", "b"); } catch (error) { message = (error as Error).message; }
    expect(message).to.include("503");
    expect(shared.store.size).to.equal(0);
    fail = false;
    expect(await cached.dailyRainfall("GHCND:X", "a", "b")).to.deep.equal(rows);
    expect(calls.daily).to.equal(2);
  });

  it("writes successes to the shared cache with a TTL and lets another instance reuse them", async () => {
    const shared = memoryShared();
    const first = fakeProvider();
    await new CachedNoaaRainfallProvider(first.provider, new NoaaReadCache(shared)).dailyRainfall("GHCND:X", "a", "b");
    await new Promise((resolve) => setImmediate(resolve));
    expect(shared.sets).to.deep.equal([{ key: "daily:GHCND:X:a:b", ttl: NOAA_DAILY_CACHE_TTL_S }]);
    const second = fakeProvider();
    const value = await new CachedNoaaRainfallProvider(second.provider, new NoaaReadCache(shared)).dailyRainfall("GHCND:X", "a", "b");
    expect(value).to.deep.equal(rows);
    expect(second.calls.daily).to.equal(0);
  });

  it("falls through to NOAA when the shared cache errors", async () => {
    const shared: SharedCache = { async get() { throw new Error("cache down"); }, async set() { throw new Error("cache down"); } };
    const { provider, calls } = fakeProvider();
    expect(await new CachedNoaaRainfallProvider(provider, new NoaaReadCache(shared)).dailyRainfall("GHCND:X", "a", "b")).to.deep.equal(rows);
    expect(calls.daily).to.equal(1);
  });
});
