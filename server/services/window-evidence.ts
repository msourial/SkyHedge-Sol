/**
 * One validated NOAA analogue package per open ladder window.
 * The old evidence route kept a single completed Des Moines week and cleared
 * every other cache key. This store keeps city + observation bounds.
 */
import { neon } from "@neondatabase/serverless";
import { NOAA_STATIONS, NoaaRainfallProvider } from "./noaa.js";
import { RainfallQuoteEngine } from "./quote-engine.js";
import {
  LIVE_CITY_SLUGS,
  openLadder,
  strikeFromAnalogueTotals,
  tenorOf,
  type LiveCitySlug,
} from "../../shared/window-ladder.js";
import type { WindowEvidencePackage } from "../../shared/window-chain.js";

/** Longer than the daily keeper so one missed run does not blank an open window. */
const TTL_MS = 36 * 60 * 60 * 1000;
const memory = new Map<string, { expiresAt: number; value: WindowEvidencePackage }>();
let tableReady = false;

export type EvidenceEngine = Pick<RainfallQuoteEngine, "analogueTotals" | "forecastCumulativeOrNull">;

export function windowEvidenceKey(city: string, observationStart: number, observationEnd: number): string {
  return `${city}:${observationStart}:${observationEnd}`;
}

export function clearWindowEvidenceMemory(): void {
  memory.clear();
  tableReady = false;
}

export function memoryWindowEvidence(): WindowEvidencePackage[] {
  const now = Date.now();
  return [...memory.values()].filter((entry) => entry.expiresAt > now).map((entry) => entry.value);
}

export async function readStoredWindowEvidence(city?: LiveCitySlug): Promise<WindowEvidencePackage[]> {
  const fromMemory = memoryWindowEvidence().filter((pkg) => !city || pkg.city === city);
  const fromDb = await readDb(city);
  const merged = new Map<string, WindowEvidencePackage>();
  for (const pkg of fromDb) merged.set(windowEvidenceKey(pkg.city, pkg.observationStart, pkg.observationEnd), pkg);
  for (const pkg of fromMemory) merged.set(windowEvidenceKey(pkg.city, pkg.observationStart, pkg.observationEnd), pkg);
  return [...merged.values()];
}

/** Build any missing open-ladder packages for one live city. Does not invent a window. */
export async function ensureCityWindowEvidence(
  city: LiveCitySlug,
  nowSeconds = Math.floor(Date.now() / 1_000),
  engine: EvidenceEngine = new RainfallQuoteEngine(new NoaaRainfallProvider()),
): Promise<{ packages: WindowEvidencePackage[]; unavailable: Array<{ observationStart: number; observationEnd: number; reason: string }> }> {
  const packages: WindowEvidencePackage[] = [];
  const unavailable: Array<{ observationStart: number; observationEnd: number; reason: string }> = [];
  const stored = await readStoredWindowEvidence(city);
  const known = new Map(stored.map((pkg) => [windowEvidenceKey(pkg.city, pkg.observationStart, pkg.observationEnd), pkg]));
  for (const window of openLadder(nowSeconds)) {
    const key = windowEvidenceKey(city, window.observationStart, window.observationEnd);
    const cached = fresh(key) ?? known.get(key) ?? null;
    if (cached) {
      remember(key, cached);
      packages.push(cached);
      continue;
    }
    try {
      const built = await buildPackage(city, window, engine);
      remember(key, built);
      await writeDb(key, built);
      packages.push(built);
    } catch (error) {
      unavailable.push({
        observationStart: window.observationStart,
        observationEnd: window.observationEnd,
        reason: error instanceof Error ? error.message : "NOAA analogue package unavailable.",
      });
    }
  }
  return { packages, unavailable };
}

/** Keeper path: fill packages when a rung is open, city by city, without dropping earlier windows. */
export async function ensureAllWindowEvidence(nowSeconds = Math.floor(Date.now() / 1_000), engine?: EvidenceEngine) {
  const built: Array<{ city: LiveCitySlug; observationStart: number; observationEnd: number; strikeMm: number }> = [];
  const unavailable: Array<{ city: LiveCitySlug; observationStart: number; observationEnd: number; reason: string }> = [];
  for (const city of LIVE_CITY_SLUGS) {
    const result = await ensureCityWindowEvidence(city, nowSeconds, engine);
    for (const pkg of result.packages) built.push({ city, observationStart: pkg.observationStart, observationEnd: pkg.observationEnd, strikeMm: pkg.strikeMm });
    for (const miss of result.unavailable) unavailable.push({ city, ...miss });
  }
  return { built, unavailable };
}

async function buildPackage(
  city: LiveCitySlug,
  window: { tenor: "weekly" | "monthly"; observationStart: number; observationEnd: number },
  engine: EvidenceEngine,
): Promise<WindowEvidencePackage> {
  const tenor = tenorOf(window.observationStart, window.observationEnd);
  if (tenor !== window.tenor) throw new Error("Refusing a window that is not an open weekly or monthly rung.");
  const station = NOAA_STATIONS[city];
  const observationStart = new Date(window.observationStart * 1_000).toISOString().slice(0, 10);
  const observationEnd = new Date(window.observationEnd * 1_000).toISOString().slice(0, 10);
  const request = {
    city,
    stationId: station.stationId,
    observationStart,
    observationEnd,
    thresholdMm: 1,
    operator: "gte" as const,
    protectedAmount: 1n,
  };
  const analogueTotalsMm = await engine.analogueTotals(request);
  const rankedStrike = strikeFromAnalogueTotals(analogueTotalsMm);
  // A complete 10-year set whose 8th value ceils to 0 is a real dry window, not a missing package.
  const strikeMm = rankedStrike ?? 0;
  if (rankedStrike == null && analogueTotalsMm.some((value) => value > 0)) {
    const sorted = [...analogueTotalsMm].sort((left, right) => left - right);
    if (Math.ceil(sorted[7] ?? 0) !== 0) throw new Error("NOAA analogue history did not produce a positive strike.");
  }
  const forecastCumulativeMm = strikeMm > 0
    ? await engine.forecastCumulativeOrNull({ ...request, thresholdMm: strikeMm })
    : null;
  return {
    validated: true,
    city,
    stationId: station.stationId,
    tenor,
    observationStart: window.observationStart,
    observationEnd: window.observationEnd,
    analogueTotalsMm,
    strikeMm,
    forecastCumulativeMm,
  };
}

function fresh(key: string): WindowEvidencePackage | null {
  const hit = memory.get(key);
  if (!hit || hit.expiresAt <= Date.now()) return null;
  return hit.value;
}

function remember(key: string, value: WindowEvidencePackage): void {
  memory.set(key, { expiresAt: Date.now() + TTL_MS, value });
}

async function sqlClient() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const sql = neon(url);
  if (!tableReady) {
    await sql`CREATE TABLE IF NOT EXISTS window_evidence_packages (
      cache_key text PRIMARY KEY,
      package_json text NOT NULL,
      built_at timestamptz NOT NULL DEFAULT now()
    )`;
    tableReady = true;
  }
  return sql;
}

async function readDb(city?: LiveCitySlug): Promise<WindowEvidencePackage[]> {
  try {
    const sql = await sqlClient();
    if (!sql) return [];
    const rows = city
      ? await sql`SELECT package_json, built_at FROM window_evidence_packages WHERE cache_key LIKE ${`${city}:%`}`
      : await sql`SELECT package_json, built_at FROM window_evidence_packages`;
    const cutoff = Date.now() - TTL_MS;
    const packages: WindowEvidencePackage[] = [];
    for (const row of rows) {
      const builtAt = new Date(String(row.built_at)).getTime();
      if (!Number.isFinite(builtAt) || builtAt < cutoff) continue;
      const pkg = parsePackage(String(row.package_json));
      if (pkg) packages.push(pkg);
    }
    return packages;
  } catch {
    return [];
  }
}

async function writeDb(key: string, pkg: WindowEvidencePackage): Promise<void> {
  try {
    const sql = await sqlClient();
    if (!sql) return;
    const json = JSON.stringify(pkg);
    await sql`INSERT INTO window_evidence_packages (cache_key, package_json, built_at)
      VALUES (${key}, ${json}, now())
      ON CONFLICT (cache_key) DO UPDATE SET package_json = EXCLUDED.package_json, built_at = now()`;
  } catch {
    // The in-process package is still returned to this request.
  }
}

function parsePackage(json: string): WindowEvidencePackage | null {
  try {
    const value = JSON.parse(json) as WindowEvidencePackage;
    if (value?.validated !== true || !Array.isArray(value.analogueTotalsMm) || value.analogueTotalsMm.length !== 10) return null;
    if (!(LIVE_CITY_SLUGS as readonly string[]).includes(value.city)) return null;
    return value;
  } catch {
    return null;
  }
}
