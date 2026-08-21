import { createHash } from "node:crypto";

/**
 * SkyHedge city index registry.
 *
 * Each city is a tradable weather index: cumulative rainfall (mm) over a
 * standardized weekly observation window (Mon 00:00 UTC → Sun 24:00 UTC),
 * settled by the dual oracle (NOAA final, WeatherXM verifies).
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
  /** Hint used for WeatherXM station discovery near the city centroid. */
  wxmSearchHint: string;
  /** 12 monthly average rainfall normals (mm). Climatology prior only. */
  monthlyNormalsMm: number[];
  /** A: NOAA+WXM strong · B: NOAA strong, WXM moderate · C: NOAA strong, WXM thin. */
  coverageTier: CoverageTier;
}

export const CITY_INDEX: CityIndex[] = [
  {
    slug: "new-york", name: "New York", country: "United States", countryCode: "US",
    latitude: 40.7789, longitude: -73.9692,
    noaaDataset: "GHCND", noaaStationId: "GHCND:USW00094728", stationName: "NY CITY CENTRAL PARK",
    wxmSearchHint: "New York NY",
    monthlyNormalsMm: [79, 76, 97, 92, 96, 96, 111, 107, 96, 89, 84, 90],
    coverageTier: "A",
  },
  {
    slug: "chicago", name: "Chicago", country: "United States", countryCode: "US",
    latitude: 41.995, longitude: -87.9336,
    noaaDataset: "GHCND", noaaStationId: "GHCND:USW00094846", stationName: "CHICAGO OHARE INTL AP",
    wxmSearchHint: "Chicago IL",
    monthlyNormalsMm: [45, 43, 58, 82, 103, 100, 97, 99, 81, 79, 78, 57],
    coverageTier: "A",
  },
  {
    slug: "miami", name: "Miami", country: "United States", countryCode: "US",
    latitude: 25.7933, longitude: -80.2906,
    noaaDataset: "GHCND", noaaStationId: "GHCND:USW00012839", stationName: "MIAMI INTL AP",
    wxmSearchHint: "Miami FL",
    monthlyNormalsMm: [41, 52, 61, 73, 137, 246, 165, 226, 250, 161, 86, 52],
    coverageTier: "A",
  },
  {
    slug: "houston", name: "Houston", country: "United States", countryCode: "US",
    latitude: 29.99, longitude: -95.337,
    noaaDataset: "GHCND", noaaStationId: "GHCND:USW00012960", stationName: "HOUSTON INTERCONTINENTAL AP",
    wxmSearchHint: "Houston TX",
    monthlyNormalsMm: [85, 74, 81, 96, 127, 150, 96, 104, 124, 122, 101, 90],
    coverageTier: "A",
  },
  {
    slug: "london", name: "London", country: "United Kingdom", countryCode: "GB",
    latitude: 51.5074, longitude: -0.1278,
    noaaDataset: "GSOD", noaaStationId: "GSOD:03768399999", stationName: "LONDON CITY",
    wxmSearchHint: "London",
    monthlyNormalsMm: [55, 41, 42, 44, 49, 47, 40, 51, 51, 69, 60, 56],
    coverageTier: "A",
  },
  {
    slug: "tokyo", name: "Tokyo", country: "Japan", countryCode: "JP",
    latitude: 35.6762, longitude: 139.6503,
    noaaDataset: "GSOD", noaaStationId: "GSOD:47662099999", stationName: "TOKYO",
    wxmSearchHint: "Tokyo",
    monthlyNormalsMm: [52, 56, 118, 125, 138, 168, 154, 168, 210, 198, 93, 51],
    coverageTier: "A",
  },
  {
    slug: "sydney", name: "Sydney", country: "Australia", countryCode: "AU",
    latitude: -33.8688, longitude: 151.2093,
    noaaDataset: "GSOD", noaaStationId: "GSOD:94768099999", stationName: "SYDNEY (OBSERVATORY HILL)",
    wxmSearchHint: "Sydney",
    monthlyNormalsMm: [97, 115, 130, 126, 120, 131, 98, 82, 69, 77, 84, 78],
    coverageTier: "A",
  },
  {
    slug: "singapore", name: "Singapore", country: "Singapore", countryCode: "SG",
    latitude: 1.3521, longitude: 103.8198,
    noaaDataset: "GSOD", noaaStationId: "GSOD:48698099999", stationName: "SINGAPORE CHANGI INTL",
    wxmSearchHint: "Singapore",
    monthlyNormalsMm: [238, 165, 171, 180, 171, 162, 159, 175, 169, 194, 258, 269],
    coverageTier: "A",
  },
  {
    slug: "mumbai", name: "Mumbai", country: "India", countryCode: "IN",
    latitude: 19.076, longitude: 72.8777,
    noaaDataset: "GSOD", noaaStationId: "GSOD:43057099999", stationName: "BOMBAY / COLABA",
    wxmSearchHint: "Mumbai",
    monthlyNormalsMm: [1, 1, 1, 0, 12, 523, 713, 494, 312, 66, 15, 5],
    coverageTier: "B",
  },
  {
    slug: "sao-paulo", name: "São Paulo", country: "Brazil", countryCode: "BR",
    latitude: -23.5505, longitude: -46.6333,
    noaaDataset: "GSOD", noaaStationId: "GSOD:83781099999", stationName: "SAO PAULO",
    wxmSearchHint: "Sao Paulo",
    monthlyNormalsMm: [273, 229, 185, 84, 75, 56, 44, 35, 81, 124, 145, 201],
    coverageTier: "B",
  },
  {
    slug: "cairo", name: "Cairo", country: "Egypt", countryCode: "EG",
    latitude: 30.0444, longitude: 31.2357,
    noaaDataset: "GSOD", noaaStationId: "GSOD:62366099999", stationName: "CAIRO INTL",
    wxmSearchHint: "Cairo",
    monthlyNormalsMm: [5, 4, 4, 2, 1, 0, 0, 0, 0, 1, 3, 5],
    coverageTier: "C",
  },
  {
    slug: "lagos", name: "Lagos", country: "Nigeria", countryCode: "NG",
    latitude: 6.5244, longitude: 3.3792,
    noaaDataset: "GSOD", noaaStationId: "GSOD:65203099999", stationName: "LAGOS ROOF",
    wxmSearchHint: "Lagos",
    monthlyNormalsMm: [14, 42, 77, 136, 197, 316, 243, 122, 161, 136, 54, 19],
    coverageTier: "C",
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
