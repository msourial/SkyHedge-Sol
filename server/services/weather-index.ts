import { DataUnavailableError, NoaaRainfallProvider, NOAA_STATIONS, cumulativeMillimeters, type DailyRainfall, type SkyHedgeCity } from "./noaa";
import { CITY_INDEX, cityBySlug, upcomingWeeklyWindows, windowNormalMm, type CityIndex, type CoverageTier } from "../../shared/cities";

export const INDEX_METRIC = "cumulative_rainfall_mm";

export interface CityIndexState {
  slug: string;
  name: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  stationName: string;
  coverageTier: CoverageTier;
  metric: typeof INDEX_METRIC;
  currentWindow: { start: string; end: string; daysElapsed: number; daysTotal: number; progressPct: number };
  /** Live NOAA observation of the current window. null = honestly unavailable. */
  cumulativeMm: number | null;
  observedThrough: string | null;
  /** Climatological expected rainfall for this exact window (public-domain normals). */
  windowNormalMm: number;
  /** Pricing/source honesty label. */
  probabilitySource: "noaa-10yr" | "climatology-prior" | "none";
  /** Last 12 completed weekly index values. null = unavailable (needs NOAA_TOKEN). */
  weeklyHistoryMm: Array<{ week: string; mm: number | null }> | null;
}

const provider = new NoaaRainfallProvider();
const cache = new Map<string, { at: number; value: DailyRainfall[] | null }>();
const CACHE_TTL_MS = 5 * 60_000;

function isoWeekStartKey(d: Date): string {
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dow = new Date(day).getUTCDay();
  const monday = day - ((dow + 6) % 7) * 86_400_000;
  return new Date(monday).toISOString().slice(0, 10);
}

async function observedDaily(stationId: string, start: string, end: string): Promise<DailyRainfall[] | null> {
  const key = `${stationId}|${start}|${end}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  let value: DailyRainfall[] | null;
  try {
    value = await provider.dailyRainfall(stationId, start, end);
  } catch (err) {
    if (err instanceof DataUnavailableError) value = null;
    else throw err;
  }
  cache.set(key, { at: Date.now(), value });
  return value;
}

function toState(city: CityIndex): CityIndexState {
  const now = new Date();
  const windows = upcomingWeeklyWindows(now, 1);
  const current = windows[0];
  const daysElapsed = Math.max(0, Math.floor((now.getTime() - current.start.getTime()) / 86_400_000));
  const station = NOAA_STATIONS[city.slug as SkyHedgeCity];
  const startIso = current.start.toISOString().slice(0, 10);
  const endIso = current.end.toISOString().slice(0, 10);

  return {
    slug: city.slug,
    name: city.name,
    country: city.country,
    countryCode: city.countryCode,
    latitude: city.latitude,
    longitude: city.longitude,
    stationName: city.stationName,
    coverageTier: city.coverageTier,
    metric: INDEX_METRIC,
    currentWindow: {
      start: startIso,
      end: endIso,
      daysElapsed,
      daysTotal: 7,
      progressPct: Math.round((daysElapsed / 7) * 100),
    },
    cumulativeMm: null,
    observedThrough: null,
    windowNormalMm: windowNormalMm(city, current.start.getTime(), current.end.getTime()),
    probabilitySource: "climatology-prior",
    weeklyHistoryMm: null,
  };
}

/** Live window observation for a city. Returns null when NOAA is unavailable (honest). */
export async function observeWindow(city: CityIndex, start: string, end: string): Promise<{ mm: number; through: string } | null> {
  const records = await observedDaily(city.noaaStationId, start, end);
  if (!records?.length) return null;
  return { mm: Math.round(cumulativeMillimeters(records) * 10) / 10, through: records[records.length - 1].date };
}

export async function cityIndexState(slug: string): Promise<CityIndexState | null> {
  const city = cityBySlug(slug);
  if (!city) return null;
  const state = toState(city);
  const obs = await observeWindow(city, state.currentWindow.start, state.currentWindow.end);
  if (obs) {
    state.cumulativeMm = obs.mm;
    state.observedThrough = obs.through;
  }
  return state;
}

export async function allCityIndexStates(): Promise<CityIndexState[]> {
  const states = CITY_INDEX.map(toState);
  const observed = await Promise.all(states.map(async (s) => {
    const city = cityBySlug(s.slug)!;
    return observeWindow(city, s.currentWindow.start, s.currentWindow.end);
  }));
  observed.forEach((obs, i) => {
    if (obs) {
      states[i].cumulativeMm = obs.mm;
      states[i].observedThrough = obs.through;
    }
  });
  return states;
}

/** Last `weeks` completed weekly index values (weeks strictly before the current one). */
export async function weeklyHistory(city: CityIndex, weeks = 12): Promise<Array<{ week: string; mm: number | null }> | null> {
  const now = new Date();
  const current = upcomingWeeklyWindows(now, 1)[0];
  const out: Array<{ week: string; mm: number | null }> = [];
  for (let i = weeks; i >= 1; i--) {
    const start = new Date(current.start.getTime() - i * 7 * 86_400_000);
    const end = new Date(start.getTime() + 7 * 86_400_000);
    const startIso = start.toISOString().slice(0, 10);
    const endIso = end.toISOString().slice(0, 10);
    const records = await observedDaily(city.noaaStationId, startIso, endIso);
    out.push({ week: isoWeekStartKey(start), mm: records ? Math.round(cumulativeMillimeters(records) * 10) / 10 : null });
  }
  return out;
}