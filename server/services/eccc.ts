import { DataUnavailableError, type DailyRainfall } from "./noaa";

/**
 * Environment and Climate Change Canada (ECCC) MSC GeoMet-OGC-API adapter.
 * Source: https://api.weather.gc.ca/collections/climate-daily (open data, no key).
 * Off-chain only: no Canadian market exists on-chain until the admin wallet signs create_market.
 */
export interface EcccStation { city: string; province: string; climateId: string; stationName: string; latitude: number; longitude: number; }

export const ECCC_STATIONS = {
  toronto: { city: "Toronto", province: "ON", climateId: "6158731", stationName: "TORONTO INTL A", latitude: 43.6767, longitude: -79.6306 },
  vancouver: { city: "Vancouver", province: "BC", climateId: "1108395", stationName: "VANCOUVER INTL A", latitude: 49.1947, longitude: -123.1839 },
  montreal: { city: "Montreal", province: "QC", climateId: "7025251", stationName: "MONTREAL INTL A", latitude: 45.4706, longitude: -73.7408 },
} as const satisfies Record<string, EcccStation>;

export type CanadianCity = keyof typeof ECCC_STATIONS;

export function ecccClimateDailyUrl(climateId: string, start: string, end: string): string {
  const q = new URLSearchParams({ f: "json", CLIMATE_IDENTIFIER: climateId, datetime: `${start}/${end}`, sortby: "LOCAL_DATE", limit: "500" });
  return `https://api.weather.gc.ca/collections/climate-daily/items?${q}`;
}

type EcccFeature = { properties?: { LOCAL_DATE?: unknown; TOTAL_PRECIPITATION?: unknown; TOTAL_PRECIPITATION_FLAG?: unknown } };

/** ECCC flags: M = missing, E = estimated, A = accumulated, T = trace. Only blank/T are settlement-grade. */
export function parseEcccDaily(feature: EcccFeature): DailyRainfall {
  const p = feature.properties ?? {};
  const date = typeof p.LOCAL_DATE === "string" ? p.LOCAL_DATE.slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new DataUnavailableError("ECCC returned a malformed daily record");
  const flag = typeof p.TOTAL_PRECIPITATION_FLAG === "string" && p.TOTAL_PRECIPITATION_FLAG.trim() ? p.TOTAL_PRECIPITATION_FLAG.trim() : null;
  if (flag && flag !== "T") throw new DataUnavailableError(`ECCC precipitation flag ${flag} is not settlement-grade for ${date}`);
  if (p.TOTAL_PRECIPITATION === null || p.TOTAL_PRECIPITATION === undefined) throw new DataUnavailableError(`ECCC has not published precipitation for ${date}`);
  const mm = Number(p.TOTAL_PRECIPITATION);
  if (!Number.isFinite(mm) || mm < 0) throw new DataUnavailableError("ECCC returned an invalid precipitation value");
  return { date, millimeters: mm, measurementFlag: flag, qualityFlag: null };
}

export class EcccRainfallProvider {
  readonly name = "ECCC" as const;
  async dailyRainfall(city: CanadianCity, start: string, end: string): Promise<DailyRainfall[]> {
    let res: Response;
    try { res = await fetch(ecccClimateDailyUrl(ECCC_STATIONS[city].climateId, start, end)); }
    catch { throw new DataUnavailableError("ECCC climate-daily request failed"); }
    if (!res.ok) throw new DataUnavailableError(`ECCC climate-daily unavailable (${res.status})`);
    const body = await res.json() as { features?: EcccFeature[] };
    if (!body.features?.length) throw new DataUnavailableError("ECCC returned no daily records for the pinned station/window");
    return body.features.map(parseEcccDaily);
  }
}
