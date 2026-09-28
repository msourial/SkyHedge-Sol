import { createHash } from "node:crypto";

export interface Station { city: string; state: string; stationId: string; latitude: number; longitude: number; dataset?: "GHCND" | "GSOD"; }

/** NOAA station pins. A pin enables data retrieval; market release still requires evidence validation. */
export const NOAA_STATIONS: Record<"des-moines" | "new-york" | "miami" | "chicago", Station> = {
  "des-moines": { city: "Des Moines", state: "IA", stationId: "GHCND:USW00014933", latitude: 41.534, longitude: -93.663 },
  "new-york": { city: "New York", state: "NY", stationId: "GHCND:USW00094728", latitude: 40.7789, longitude: -73.9692 },
  miami: { city: "Miami", state: "FL", stationId: "GHCND:USW00012839", latitude: 25.7933, longitude: -80.2906 },
  chicago: { city: "Chicago", state: "IL", stationId: "GHCND:USW00094846", latitude: 41.995, longitude: -87.9336 },
};

export type SkyHedgeCity = keyof typeof NOAA_STATIONS;

export class DataUnavailableError extends Error {
  readonly code = "DATA_UNAVAILABLE";
  constructor(message: string) { super(message); }
}

export interface DailyRainfall {
  date: string;
  millimeters: number;
  measurementFlag?: string | null;
  qualityFlag?: string | null;
}
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
    if (!this.token) throw new DataUnavailableError("NOAA_TOKEN is required to read NOAA station observations");
    const dataset = stationId.startsWith("GSOD:") ? "GSOD" : "GHCND";
    const query = new URLSearchParams({ datasetid: dataset, datatypeid: "PRCP", stationid: stationId, startdate: start, enddate: end, units: "metric", limit: "1000" });
    let response: Response;
    try { response = await fetch(`https://www.ncei.noaa.gov/cdo-web/api/v2/data?${query}`, { headers: { token: this.token } }); }
    catch { throw new DataUnavailableError("NOAA station-observation request failed"); }
    if (!response.ok) throw new DataUnavailableError(`NOAA station observations unavailable (${response.status})`);
    const body = await response.json() as { results?: Array<{ date?: unknown; value?: unknown; attributes?: unknown }> };
    if (!body.results?.length) throw new DataUnavailableError("NOAA returned no precipitation observations for the pinned station/window");
    return body.results.map(parseNoaaDailyRainfall);
  }

  async forecastRainfall(city: SkyHedgeCity, start: string, end: string): Promise<DailyRainfall[]> {
    const station = NOAA_STATIONS[city];
    let point: Response;
    try { point = await fetch(`https://api.weather.gov/points/${station.latitude},${station.longitude}`, { headers: { "User-Agent": "SkyHedge/1.0 contact@skyhedge.dev" } }); }
    catch { throw new DataUnavailableError("NOAA forecast point lookup failed"); }
    if (!point.ok) throw new DataUnavailableError(`NOAA forecast point unavailable (${point.status})`);
    const pointData = await point.json() as { properties?: { forecastGridData?: string } };
    if (!pointData.properties?.forecastGridData) throw new DataUnavailableError("NOAA did not provide a raw forecast-grid endpoint");
    let forecast: Response;
    try { forecast = await fetch(pointData.properties.forecastGridData, { headers: { "User-Agent": "SkyHedge/1.0 contact@skyhedge.dev" } }); }
    catch { throw new DataUnavailableError("NOAA quantitative precipitation forecast request failed"); }
    if (!forecast.ok) throw new DataUnavailableError(`NOAA quantitative precipitation forecast unavailable (${forecast.status})`);
    return parseNoaaQpfGrid(await forecast.json(), start, end);
  }
}

/**
 * Parse the CDO v2 GHCN-Daily ancillary flags. NOAA documents the attribute
 * order as measurement, quality, source, and observation time. Blank quality
 * means the value passed NOAA QA; a nonblank quality flag is a failed check.
 */
export function parseNoaaDailyRainfall(record: { date?: unknown; value?: unknown; attributes?: unknown }): DailyRainfall {
  if (typeof record.date !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(record.date)
    || !Number.isFinite(record.value) || (record.value as number) < 0) {
    throw new DataUnavailableError("NOAA returned a malformed daily precipitation record");
  }
  if (typeof record.attributes !== "string") {
    throw new DataUnavailableError("NOAA omitted GHCN-Daily quality attributes");
  }
  const flags = record.attributes.split(",");
  if (flags.length !== 4) throw new DataUnavailableError("NOAA returned malformed GHCN-Daily quality attributes");
  const [measurement = "", quality = ""] = flags;
  if (quality.trim()) throw new DataUnavailableError(`NOAA precipitation failed quality flag ${quality.trim()}`);
  // B and D are daily sums assembled from sub-daily totals. T is an observed
  // trace. A spans multiple days, and P is only presumed zero; neither can be
  // safely allocated to an exact daily settlement index.
  if (measurement.trim() && !["B", "D", "T"].includes(measurement.trim())) {
    throw new DataUnavailableError(`NOAA precipitation has unsupported measurement flag ${measurement.trim()}`);
  }
  return {
    date: record.date.slice(0, 10),
    millimeters: record.value as number,
    measurementFlag: measurement.trim() || null,
    qualityFlag: quality.trim() || null,
  };
}

type QpfInterval = { validTime?: unknown; value?: unknown };

/**
 * Parse NWS raw quantitative-precipitation grid data for a half-open UTC date
 * window. Prose forecasts, null intervals, gaps, overlaps, and unsupported
 * units are unavailable; none are silently converted to zero rainfall.
 */
export function parseNoaaQpfGrid(body: unknown, start: string, endExclusive: string): DailyRainfall[] {
  const rangeStart = utcMidnight(start);
  const rangeEnd = utcMidnight(endExclusive);
  if (rangeStart >= rangeEnd) throw new DataUnavailableError("NOAA forecast window is invalid");

  const properties = isObject(body) && isObject(body.properties) ? body.properties : null;
  const layer = properties && isObject(properties.quantitativePrecipitation) ? properties.quantitativePrecipitation : null;
  const values = layer?.values;
  if (!layer || typeof layer.uom !== "string" || !Array.isArray(values) || values.length === 0) {
    throw new DataUnavailableError("NOAA quantitative precipitation grid data is missing");
  }
  const millimeterFactor = qpfUnitToMillimeters(layer.uom);
  const intervals = (values as QpfInterval[]).map((record) => {
    if (!record || typeof record.validTime !== "string" || !Number.isFinite(record.value) || (record.value as number) < 0) {
      throw new DataUnavailableError("NOAA quantitative precipitation interval is missing or malformed");
    }
    const [startTime, duration] = record.validTime.split("/");
    const intervalStart = Date.parse(startTime ?? "");
    const durationMs = parseIsoDurationMilliseconds(duration ?? "");
    if (!Number.isFinite(intervalStart) || durationMs <= 0) {
      throw new DataUnavailableError("NOAA quantitative precipitation interval is malformed");
    }
    return { start: intervalStart, end: intervalStart + durationMs, millimeters: roundMm((record.value as number) * millimeterFactor) };
  }).sort((left, right) => left.start - right.start);

  const daily = new Map<string, number>();
  let cursor = rangeStart;
  for (const interval of intervals) {
    if (interval.end <= rangeStart || interval.start >= rangeEnd) continue;
    if (interval.start < rangeStart || interval.end > rangeEnd) {
      throw new DataUnavailableError("NOAA forecast does not align with the exact requested observation window");
    }
    if (interval.start < cursor) throw new DataUnavailableError("NOAA quantitative precipitation intervals overlap");
    if (interval.start > cursor) throw new DataUnavailableError("NOAA forecast does not fully cover the requested observation window");
    const dayStart = Date.UTC(new Date(interval.start).getUTCFullYear(), new Date(interval.start).getUTCMonth(), new Date(interval.start).getUTCDate());
    const dayEnd = Date.UTC(new Date(interval.end).getUTCFullYear(), new Date(interval.end).getUTCMonth(), new Date(interval.end).getUTCDate());
    if (interval.end > interval.start && dayStart !== dayEnd && interval.end !== dayStart + 86_400_000) {
      throw new DataUnavailableError("NOAA forecast interval crosses a UTC day boundary and cannot be assigned exactly");
    }
    const date = new Date(interval.start).toISOString().slice(0, 10);
    daily.set(date, (daily.get(date) ?? 0) + interval.millimeters);
    cursor = interval.end;
  }
  if (cursor !== rangeEnd) throw new DataUnavailableError("NOAA forecast does not fully cover the requested observation window");

  const result: DailyRainfall[] = [];
  for (let date = start; date < endExclusive; date = addUtcDays(date, 1)) {
    const millimeters = daily.get(date);
    if (millimeters === undefined) throw new DataUnavailableError("NOAA forecast is missing one or more requested days");
    result.push({ date, millimeters: roundMm(millimeters) });
  }
  return result;
}

export function cumulativeMillimeters(records: DailyRainfall[]): number { return records.reduce((total, record) => total + record.millimeters, 0); }
export function canonicalSourceHash(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function qpfUnitToMillimeters(unit: string): number {
  if (["wmoUnit:mm", "mm", "mm_h-1"].includes(unit)) return 1;
  if (["wmoUnit:in", "in", "in_h-1"].includes(unit)) return 25.4;
  throw new DataUnavailableError(`NOAA quantitative precipitation uses unsupported unit ${unit}`);
}
function utcMidnight(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new DataUnavailableError("NOAA forecast dates must use YYYY-MM-DD");
  const parsed = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== date) throw new DataUnavailableError("NOAA forecast dates are invalid");
  return parsed;
}
function parseIsoDurationMilliseconds(value: string): number {
  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!match) return 0;
  return (((Number(match[1] ?? 0) * 24 + Number(match[2] ?? 0)) * 60 + Number(match[3] ?? 0)) * 60 + Number(match[4] ?? 0)) * 1_000;
}
function addUtcDays(date: string, days: number): string { const result = new Date(utcMidnight(date)); result.setUTCDate(result.getUTCDate() + days); return result.toISOString().slice(0, 10); }
function roundMm(value: number): number { return Math.round(value * 100) / 100; }
