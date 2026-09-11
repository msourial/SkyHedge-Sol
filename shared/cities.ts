import { createHash } from "node:crypto";

/**
 * SkyHedge city index registry.
 *
 * Each city is a tradable weather index: cumulative rainfall (mm) over a
 * standardized weekly observation window (Mon 00:00 UTC → Sun 24:00 UTC),
 * settled by NOAA final observations.
 *
 * Station mappings were resolved from NOAA's public inventories:
 *   - US cities: GHCN-daily (https://www.ncei.noaa.gov/pub/data/ghcn/daily/)
 *   - Global cities: ISD/GSOD via isd-history.txt (GHCN-daily coverage outside
 *     the US is stale for most urban stations; GSOD is current and global).
 *
 * monthlyNormalsMm are public-domain climatological normals (WMO-style
 * 1991–2020 approximations). They are used ONLY as a pricing prior when live
 * NOAA history is unavailable and are always labeled "climatology-prior".
 */

export type CoverageTier = "A" | "B" | "C";

export interface CityIndex {
  slug: string;
  name: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  /** NOAA CDO dataset and station id used for final observations. */
  noaaDataset: "GHCND" | "GSOD";
  noaaStationId: string;
  stationName: string;
  /** 12 monthly average rainfall normals (mm). Climatology prior only. */
  monthlyNormalsMm: number[];
  /** V1 NOAA station coverage classification. */
  coverageTier: CoverageTier;
}

export const CITY_INDEX: CityIndex[] = [
  {
    slug: "new-york", name: "New York", country: "United States", countryCode: "US",
    latitude: 40.7789, longitude: -73.9692,
    noaaDataset: "GHCND", noaaStationId: "GHCND:USW00094728", stationName: "NY CITY CENTRAL PARK",
    monthlyNormalsMm: [79, 76, 97, 92, 96, 96, 111, 107, 96, 89, 84, 90],
    coverageTier: "A",
  },
  {
    slug: "chicago", name: "Chicago", country: "United States", countryCode: "US",
    latitude: 41.995, longitude: -87.9336,
    noaaDataset: "GHCND", noaaStationId: "GHCND:USW00094846", stationName: "CHICAGO OHARE INTL AP",
    monthlyNormalsMm: [45, 43, 58, 82, 103, 100, 97, 99, 81, 79, 78, 57],
    coverageTier: "A",
  },
  {
    slug: "miami", name: "Miami", country: "United States", countryCode: "US",
    latitude: 25.7933, longitude: -80.2906,
    noaaDataset: "GHCND", noaaStationId: "GHCND:USW00012839", stationName: "MIAMI INTL AP",
    monthlyNormalsMm: [41, 52, 61, 73, 137, 246, 165, 226, 250, 161, 86, 52],
    coverageTier: "A",
  },
];

export const cityBySlug = (slug: string): CityIndex | undefined => CITY_INDEX.find((c) => c.slug === slug);

/** Must match the on-chain city_hash (sha256 of the slug). */
export const cityHash = (slug: string): string => createHash("sha256").update(slug).digest("hex");

/** Resolve a 32-byte on-chain city_hash (hex) back to a registry entry. */
export function cityByHash(hashHex: string): CityIndex | undefined {
  return CITY_INDEX.find((c) => cityHash(c.slug) === hashHex);
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Climatological expected rainfall (mm) for an arbitrary [startMs, endMs] window,
 * prorated from the city's monthly normals by day overlap.
 */
export function windowNormalMm(city: CityIndex, startMs: number, endMs: number): number {
  let total = 0;
  for (let t = startOfUtcDay(startMs); t < endMs; t += 86_400_000) {
    const d = new Date(t);
    const month = d.getUTCMonth();
    total += city.monthlyNormalsMm[month] / DAYS_IN_MONTH[month];
  }
  return Math.round(total * 10) / 10;
}

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Standardized weekly index window: the ISO week (Mon 00:00 UTC → next Mon 00:00 UTC) containing `when`. */
export function weeklyWindowFor(when: Date): { start: Date; end: Date } {
  const day = Date.UTC(when.getUTCFullYear(), when.getUTCMonth(), when.getUTCDate());
  const dow = new Date(day).getUTCDay(); // 0=Sun
  const mondayOffset = (dow + 6) % 7;
  const start = day - mondayOffset * 86_400_000;
  return { start: new Date(start), end: new Date(start + 7 * 86_400_000) };
}

/** The next `count` weekly windows starting from the week containing `from`. */
export function upcomingWeeklyWindows(from: Date, count: number): Array<{ start: Date; end: Date }> {
  const first = weeklyWindowFor(from);
  return Array.from({ length: count }, (_, i) => ({
    start: new Date(first.start.getTime() + i * 7 * 86_400_000),
    end: new Date(first.end.getTime() + i * 7 * 86_400_000),
  }));
}
