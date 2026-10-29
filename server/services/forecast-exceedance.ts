import { PERILS } from "../../shared/perils.js";
import type { CoverProgress, ForecastEdge, ForecastExceedance } from "../../shared/weather-signals.js";
import { aggregateNative } from "./ghcnd-daily.js";
import { NOAA_STATIONS } from "./noaa.js";
import { NoaaReadCache } from "./noaa-cache.js";
import { readCoverProgress, WEATHER_SIGNAL_TTL_S } from "./cover-progress.js";
import { CITY_TIMEZONES, cityToday, readMarketWeatherWindow, validateWeatherWindow, weatherUnit, type ForecastWindow } from "./market-weather-window.js";

interface EnsembleResponse {
  daily?: Record<string, unknown>;
  daily_units?: Record<string, unknown>;
}
const VARIABLES = { rain: "precipitation_sum", snow: "snowfall_sum", heat: "temperature_2m_max" } as const;
const MODEL = "NOAA GEFS (gfs_seamless) via Open-Meteo Ensemble API" as const;

/** Converts the API's declared unit into settlement native units, including SNOW cm -> mm. */
export function ensembleNative(value: number, unit: unknown, peril: ForecastWindow["peril"]): number | null {
  if (!Number.isFinite(value)) return null;
  if (peril === "heat") {
    if (unit === "°C") return value;
    if (unit === "°F") return (value - 32) * 5 / 9;
    return null;
  }
  if (value < 0) return null;
  if (peril === "rain" || peril === "snow") {
    if (unit === "mm") return value;
    if (unit === "cm") return value * 10;
    if (unit === "inch" || unit === "in") return value * 25.4;
  }
  return null;
}

/**
 * Counts complete member trajectories, never PoP or a deterministic QPF proxy.
 * Past station-calendar days require a complete observed prefix. Today's daily
 * forecast may be used; missing past days may never be replaced by forecasts.
 */
export function forecastFromEnsemble(input: ForecastWindow, body: EnsembleResponse, options: {
  now: Date; fetchedAt: string; observed?: CoverProgress | null;
}): ForecastExceedance | null {
  if (!(input.peril in VARIABLES) || !Number.isFinite(input.trigger) || input.trigger < 0) return null;
  const dates = validateWeatherWindow(input);
  const today = cityToday(input.city, options.now);
  const past = dates.filter((date) => date < today);
  const remaining = dates.filter((date) => date >= today);
  if (!remaining.length) return null;
  const observed = options.observed;
  if (past.length && (!observed?.complete || observed.daysReported !== past.length || observed.daysTotal !== past.length
    || observed.observedThrough !== past.at(-1) || observed.valueNative == null || !Number.isFinite(observed.valueNative)
    || observed.unit !== weatherUnit(input.peril))) return null;
  const daily = body?.daily;
  if (!daily || !Array.isArray(daily.time) || !daily.time.every((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))) return null;
  const times = daily.time as string[];
  if (new Set(times).size !== times.length) return null;
  const indices = remaining.map((date) => times.indexOf(date));
  if (indices.some((index) => index < 0)) return null;
  const variable = VARIABLES[input.peril as keyof typeof VARIABLES];
  let membersAtOrAbove = 0;
  let membersTotal = 0;
  for (let member = 0; member <= 30; member++) {
    const field = member === 0 ? variable : `${variable}_member${String(member).padStart(2, "0")}`;
    const values = daily[field];
    if (!Array.isArray(values) || values.length !== times.length) continue;
    const native = indices.map((i) => typeof values[i] === "number" ? ensembleNative(values[i], body.daily_units?.[field], input.peril) : null);
    if (native.some((value) => value == null)) continue;
    const aggregateValues = native as number[];
    if (past.length) aggregateValues.push(observed!.valueNative!);
    const total = aggregateNative(PERILS[input.peril], aggregateValues);
    const operator = input.operator ?? "gte";
    const hits = operator === "gt" ? total > input.trigger : operator === "lt" ? total < input.trigger : operator === "lte" ? total <= input.trigger : total >= input.trigger;
    membersTotal++;
    if (hits) membersAtOrAbove++;
  }
  if (membersTotal < 20) return null;
  return { probability: membersAtOrAbove / membersTotal, membersAtOrAbove, membersTotal, model: MODEL, source: "NOAA GEFS ensemble",
    issuedAt: null, fetchedAt: options.fetchedAt, windowStart: input.start, windowEnd: input.end, trigger: input.trigger, unit: weatherUnit(input.peril) };
}

export class ForecastExceedanceReader {
  private readonly now: () => Date;
  private readonly cache: NoaaReadCache;
  constructor(private readonly deps: {
    fetcher?: typeof fetch; now?: () => Date; cache?: NoaaReadCache;
    readProgress?: typeof readCoverProgress; resolveMarket?: typeof readMarketWeatherWindow;
  } = {}) {
    this.now = deps.now ?? (() => new Date());
    this.cache = deps.cache ?? new NoaaReadCache(null, () => this.now().getTime());
  }
  async read(input: string | ForecastWindow): Promise<ForecastExceedance | null> {
    const window = typeof input === "string" ? await (this.deps.resolveMarket ?? readMarketWeatherWindow)(input) : input;
    const dates = validateWeatherWindow(window);
    // Generic 10 m wind maxima/gusts do not represent the settlement's fastest
    // two-minute wind (WSF2). No compatible GEFS variable is exposed here.
    if (!(window.peril in VARIABLES)) return null;
    const now = this.now();
    const today = cityToday(window.city, now);
    if (window.end <= today) return null;
    let observed: CoverProgress | null = null;
    if (window.start < today) {
      try { observed = await (this.deps.readProgress ?? readCoverProgress)({ ...window, end: today }); }
      catch { return null; }
      if (!observed.complete || observed.valueNative == null) return null;
    }
    const station = NOAA_STATIONS[window.city];
    const variable = VARIABLES[window.peril as keyof typeof VARIABLES];
    const raw = await this.cache.read(`gefs:gfs_seamless:${station.stationId}:${variable}:${today}`, WEATHER_SIGNAL_TTL_S, async () => {
      try {
        const query = new URLSearchParams({ latitude: String(station.latitude), longitude: String(station.longitude), daily: variable, models: "gfs_seamless",
          timezone: CITY_TIMEZONES[window.city], forecast_days: "35", precipitation_unit: "mm", temperature_unit: "celsius" });
        const response = await (this.deps.fetcher ?? fetch)(`https://ensemble-api.open-meteo.com/v1/ensemble?${query}`, { signal: AbortSignal.timeout(8_000) });
        if (!response.ok) return null;
        return { body: await response.json() as EnsembleResponse, fetchedAt: this.now().toISOString() };
      } catch { return null; }
    });
    if (!raw || !dates.length) return null;
    return forecastFromEnsemble(window, raw.body, { now, fetchedAt: raw.fetchedAt, observed });
  }
  async edge(market: string): Promise<ForecastEdge> {
    const window = await (this.deps.resolveMarket ?? readMarketWeatherWindow)(market);
    return { forecast: await this.read(window), historyProbability: window.historyProbability };
  }
}
export const forecastExceedanceReader = new ForecastExceedanceReader();
export function readForecastExceedance(input: string | ForecastWindow): Promise<ForecastExceedance | null> { return forecastExceedanceReader.read(input); }
export function readForecastEdge(market: string): Promise<ForecastEdge> { return forecastExceedanceReader.edge(market); }
