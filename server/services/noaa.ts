import { createHash } from "node:crypto";
import { CITY_INDEX } from "../../shared/cities";

export interface Station { city: string; state: string; stationId: string; latitude: number; longitude: number; dataset?: "GHCND" | "GSOD"; }

const US_STATIONS: Record<string, Station> = {
  "new-york": { city: "New York", state: "NY", stationId: "GHCND:USW00094728", latitude: 40.7789, longitude: -73.9692 },
  miami: { city: "Miami", state: "FL", stationId: "GHCND:USW00012839", latitude: 25.7933, longitude: -80.2906 },
  chicago: { city: "Chicago", state: "IL", stationId: "GHCND:USW00094846", latitude: 41.995, longitude: -87.9336 },
  dallas: { city: "Dallas", state: "TX", stationId: "GHCND:USW00013960", latitude: 32.847, longitude: -96.851 },
  houston: { city: "Houston", state: "TX", stationId: "GHCND:USW00012960", latitude: 29.99, longitude: -95.337 },
  seattle: { city: "Seattle", state: "WA", stationId: "GHCND:USW00024233", latitude: 47.45, longitude: -122.309 },
  "san-francisco": { city: "San Francisco", state: "CA", stationId: "GHCND:USW00023234", latitude: 37.621, longitude: -122.379 },
  "los-angeles": { city: "Los Angeles", state: "CA", stationId: "GHCND:USW00023174", latitude: 33.942, longitude: -118.408 },
  phoenix: { city: "Phoenix", state: "AZ", stationId: "GHCND:USW00023183", latitude: 33.435, longitude: -112.058 },
  boston: { city: "Boston", state: "MA", stationId: "GHCND:USW00014739", latitude: 42.361, longitude: -71.011 },
  atlanta: { city: "Atlanta", state: "GA", stationId: "GHCND:USW00013874", latitude: 33.64, longitude: -84.427 },
  minneapolis: { city: "Minneapolis", state: "MN", stationId: "GHCND:USW00014922", latitude: 44.884, longitude: -93.222 },
  "las-vegas": { city: "Las Vegas", state: "NV", stationId: "GHCND:USW00023169", latitude: 36.085, longitude: -115.151 },
  "new-orleans": { city: "New Orleans", state: "LA", stationId: "GHCND:USW00012916", latitude: 29.993, longitude: -90.258 },
  portland: { city: "Portland", state: "OR", stationId: "GHCND:USW00024229", latitude: 45.589, longitude: -122.595 },
};

const GLOBAL_STATIONS: Record<string, Station> = Object.fromEntries(
  CITY_INDEX.filter((c) => c.noaaDataset === "GSOD").map((c) => [
    c.slug,
    { city: c.name, state: c.countryCode, stationId: c.noaaStationId, latitude: c.latitude, longitude: c.longitude, dataset: "GSOD" as const },
  ]),
);

/** Curated index cities + legacy US coverage. Global entries resolve via GSOD (current data); US via GHCN-daily. */
export const NOAA_STATIONS: Record<string, Station> = { ...US_STATIONS, ...GLOBAL_STATIONS };

export type SkyHedgeCity = keyof typeof NOAA_STATIONS;

export class DataUnavailableError extends Error {
  readonly code = "DATA_UNAVAILABLE";
  constructor(message: string) { super(message); }
}

export interface DailyRainfall { date: string; millimeters: number; }
export interface RainfallProvider {
  readonly name: "NOAA";
  dailyRainfall(stationId: string, start: string, end: string): Promise<DailyRainfall[]>;
  forecastRainfall(city: SkyHedgeCity, start: string, end: string): Promise<DailyRainfall[]>;
}

/** The sole settlement source. Callers must surface DATA_UNAVAILABLE, never invent a value. */
export class NoaaRainfallProvider implements RainfallProvider {
  readonly name = "NOAA" as const;
  private readonly token = process.env.NOAA_TOKEN;

  async dailyRainfall(stationId: string, start: string, end: string): Promise<DailyRainfall[]> {
    if (!this.token) throw new DataUnavailableError("NOAA_TOKEN is required for final NOAA station observations");
    const dataset = stationId.startsWith("GSOD:") ? "GSOD" : "GHCND";
    const query = new URLSearchParams({ datasetid: dataset, datatypeid: "PRCP", stationid: stationId, startdate: start, enddate: end, units: "metric", limit: "1000" });
    let response: Response;
    try { response = await fetch(`https://www.ncei.noaa.gov/cdo-web/api/v2/data?${query}`, { headers: { token: this.token } }); }
    catch { throw new DataUnavailableError("NOAA final-observation request failed"); }
    if (!response.ok) throw new DataUnavailableError(`NOAA final observations unavailable (${response.status})`);
    const body = await response.json() as { results?: Array<{ date: string; value: number }> };
    if (!body.results?.length) throw new DataUnavailableError("NOAA returned no precipitation observations for the pinned station/window");
    return body.results.map(({ date, value }) => ({ date: date.slice(0, 10), millimeters: value }));
  }

  async forecastRainfall(city: SkyHedgeCity, start: string, end: string): Promise<DailyRainfall[]> {
    const station = NOAA_STATIONS[city];
    let point: Response;
    try { point = await fetch(`https://api.weather.gov/points/${station.latitude},${station.longitude}`, { headers: { "User-Agent": "SkyHedge/1.0 contact@skyhedge.dev" } }); }
    catch { throw new DataUnavailableError("NOAA forecast point lookup failed"); }
    if (!point.ok) throw new DataUnavailableError(`NOAA forecast point unavailable (${point.status})`);
    const pointData = await point.json() as { properties?: { forecast?: string } };
    if (!pointData.properties?.forecast) throw new DataUnavailableError("NOAA did not provide a forecast endpoint");
    const forecast = await fetch(pointData.properties.forecast, { headers: { "User-Agent": "SkyHedge/1.0 contact@skyhedge.dev" } });
    if (!forecast.ok) throw new DataUnavailableError(`NOAA forecast unavailable (${forecast.status})`);
    const body = await forecast.json() as { properties?: { periods?: Array<{ startTime: string; detailedForecast?: string }> } };
    const periods = body.properties?.periods ?? [];
    const values = periods.filter((p) => p.startTime.slice(0, 10) >= start && p.startTime.slice(0, 10) <= end).map((p) => ({ date: p.startTime.slice(0, 10), millimeters: parseForecastMillimeters(p.detailedForecast ?? "") }));
    if (!values.length) throw new DataUnavailableError("NOAA forecast does not cover the requested observation window");
    return values;
  }
}

export function cumulativeMillimeters(records: DailyRainfall[]): number { return records.reduce((total, record) => total + record.millimeters, 0); }
export function canonicalSourceHash(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

function parseForecastMillimeters(text: string): number {
  const match = text.match(/([\d.]+)\s*(?:to\s*([\d.]+)\s*)?inches? of rain/i);
  if (!match) return 0;
  const inches = match[2] ? (Number(match[1]) + Number(match[2])) / 2 : Number(match[1]);
  return Math.round(inches * 25.4 * 100) / 100;
}
