import type { CoverProgress } from "../../shared/weather-signals.js";
import { PERILS, type PerilId } from "../../shared/perils.js";
import { DataUnavailableError, NOAA_STATIONS } from "./noaa.js";
import { aggregateNative, parseCdoObservation, type DailyObservation } from "./ghcnd-daily.js";
import { NoaaReadCache } from "./noaa-cache.js";
import { cityToday, previousDay, readMarketWeatherWindow, validateWeatherWindow, weatherUnit, type WeatherWindow } from "./market-weather-window.js";

export const CDO_SOURCE = "NOAA GHCN-Daily via CDO v2";
export const ACIS_SOURCE = "NOAA GHCN-Daily via RCC-ACIS";
export const WEATHER_SIGNAL_TTL_S = 3_600;
class ObservationRejectedError extends DataUnavailableError {}
const ACIS_ELEMENTS = { rain: "pcpn", snow: "snow", heat: "maxt" } as const;

/** ACIS uses inches and Fahrenheit. Missing stays absent; trace precipitation is an observed zero. */
export function parseAcisObservations(peril: PerilId, body: unknown): DailyObservation[] {
  if (!(peril in ACIS_ELEMENTS)) throw new DataUnavailableError("RCC-ACIS does not expose the settlement WSF2 element (cold is unsupported)");
  const data = (body as { data?: unknown })?.data;
  if (!Array.isArray(data)) throw new DataUnavailableError("RCC-ACIS returned no daily observations");
  return data.flatMap((row: unknown) => {
    if (!Array.isArray(row) || row.length !== 2 || typeof row[0] !== "string") throw new DataUnavailableError("Malformed RCC-ACIS daily observation");
    // Request add:f so estimated/suspect/accumulated values cannot silently enter a gauge.
    const cell = Array.isArray(row[1]) ? row[1] : [row[1], ""];
    const [raw, rawFlag] = cell;
    const flag = typeof rawFlag === "string" ? rawFlag.trim() : rawFlag;
    if (raw === "M") return [];
    if (flag && flag !== "T") throw new DataUnavailableError("RCC-ACIS returned a flagged daily observation");
    const trace = raw === "T" || flag === "T";
    if (trace && peril === "heat") throw new DataUnavailableError("Invalid temperature trace");
    if (!trace && (typeof raw !== "string" && typeof raw !== "number" || !/^-?\d+(?:\.\d+)?$/.test(String(raw)))) throw new DataUnavailableError("Malformed RCC-ACIS value");
    const value = trace ? 0 : peril === "heat" ? (Number(raw) - 32) * 5 / 9 : Number(raw) * 25.4;
    // Keep the settlement's daily native precision (SNOW whole mm, others tenths).
    const precision = peril === "snow" ? 1 : 10;
    return [parseCdoObservation(peril, { date: row[0], value: Math.round(value * precision) / precision, attributes: `${trace ? "T" : ""},,,` })];
  });
}

interface ProgressDependencies {
  fetcher?: typeof fetch;
  now?: () => Date;
  token?: () => string | undefined;
  cache?: NoaaReadCache;
  resolveMarket?: typeof readMarketWeatherWindow;
}

export class CoverProgressReader {
  private readonly cache: NoaaReadCache;
  private readonly now: () => Date;
  private readonly fetcher: typeof fetch;
  constructor(private readonly deps: ProgressDependencies = {}) {
    this.now = deps.now ?? (() => new Date());
    this.fetcher = deps.fetcher ?? fetch;
    this.cache = deps.cache ?? new NoaaReadCache(null, () => this.now().getTime());
  }

  async read(input: string | WeatherWindow): Promise<CoverProgress> {
    const window = typeof input === "string" ? await (this.deps.resolveMarket ?? readMarketWeatherWindow)(input) : input;
    const dates = validateWeatherWindow(window);
    const { city, peril, start, end } = window;
    const now = this.now();
    const today = cityToday(city, now);
    const base: CoverProgress = { valueNative: null, unit: weatherUnit(peril), observedThrough: null, daysReported: 0, daysTotal: dates.length, complete: false,
      state: "unavailable", source: "NOAA GHCN-Daily", fetchedAt: now.toISOString() };
    if (!PERILS[peril].open) return { ...base, reason: PERILS[peril].closedReason! };
    if (today < start) return { ...base, state: "not_started" };
    const cutoff = end < today ? end : today;
    if (cutoff <= start) return { ...base, reason: "No completed observation day has reported yet" };
    const station = NOAA_STATIONS[city].stationId;
    const result = await this.cache.read(`progress:${station}:${PERILS[peril].ghcndElement}:${start}:${end}:${cutoff}`, WEATHER_SIGNAL_TTL_S, async () => {
      try {
        let observations: DailyObservation[];
        let source = CDO_SOURCE;
        try { observations = await this.cdo(peril, station, start, previousDay(cutoff)); }
        catch (error) {
          // A transport failure can fall back; a failed NOAA quality check cannot.
          if (error instanceof ObservationRejectedError) throw error;
          source = ACIS_SOURCE;
          observations = await this.acis(peril, station, start, previousDay(cutoff));
        }
        const byDate = new Map<string, DailyObservation>();
        for (const record of observations) {
          if (!dates.includes(record.date) || record.date >= cutoff) throw new DataUnavailableError("NOAA returned an out-of-window observation");
          if (byDate.has(record.date)) throw new DataUnavailableError("NOAA returned a duplicate daily observation");
          byDate.set(record.date, record);
        }
        const records = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
        return { records, source, fetchedAt: this.now().toISOString() };
      } catch (error) {
        return { records: [] as DailyObservation[], source: "NOAA GHCN-Daily", fetchedAt: this.now().toISOString(), reason: error instanceof DataUnavailableError ? error.message : "NOAA observations could not be read" };
      }
    });
    if (!result.records.length) return { ...base, source: result.source, fetchedAt: result.fetchedAt, reason: result.reason ?? "NOAA returned no reported days for this window" };
    const complete = result.records.length === dates.length;
    return { ...base, valueNative: Math.round(aggregateNative(PERILS[peril], result.records.map((d) => d.value)) * 10) / 10,
      observedThrough: result.records.at(-1)!.date, daysReported: result.records.length, complete,
      state: complete ? "complete" : today >= end ? "ended_waiting" : "tracking", source: result.source, fetchedAt: result.fetchedAt };
  }

  private async cdo(peril: PerilId, station: string, start: string, end: string): Promise<DailyObservation[]> {
    const token = (this.deps.token ?? (() => process.env.NOAA_TOKEN))();
    if (!token) throw new DataUnavailableError("NOAA_TOKEN absent");
    const query = new URLSearchParams({ datasetid: "GHCND", datatypeid: PERILS[peril].ghcndElement!, stationid: station, startdate: start, enddate: end, units: "metric", limit: "1000" });
    const response = await this.fetcher(`https://www.ncei.noaa.gov/cdo-web/api/v2/data?${query}`, { headers: { token }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new DataUnavailableError("NOAA CDO observations unavailable");
    const body = await response.json() as { results?: Parameters<typeof parseCdoObservation>[1][] };
    if (!body.results?.length) throw new DataUnavailableError("NOAA returned no observations");
    try { return body.results.map((record) => parseCdoObservation(peril, record)); }
    catch (error) { throw new ObservationRejectedError(error instanceof Error ? error.message : "NOAA rejected an observation"); }
  }
  private async acis(peril: PerilId, station: string, start: string, end: string): Promise<DailyObservation[]> {
    if (!(peril in ACIS_ELEMENTS)) throw new DataUnavailableError("CDO WSF2 unavailable; RCC-ACIS does not expose the settlement WSF2 element");
    const response = await this.fetcher("https://data.rcc-acis.org/StnData", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({ sid: station.replace(/^GHCND:/, ""), sdate: start, edate: end, elems: [{ name: ACIS_ELEMENTS[peril as keyof typeof ACIS_ELEMENTS], add: "f", prec: 4 }] }) });
    if (!response.ok) throw new DataUnavailableError("RCC-ACIS observations unavailable");
    return parseAcisObservations(peril, await response.json());
  }
}
export const coverProgressReader = new CoverProgressReader();
export function readCoverProgress(input: string | WeatherWindow): Promise<CoverProgress> { return coverProgressReader.read(input); }
