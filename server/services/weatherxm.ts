import { DataUnavailableError, NOAA_STATIONS, type SkyHedgeCity } from "./noaa";
import { loadMethodology } from "./methodology";

const methodology = loadMethodology();

export interface WxmStation { id: string; name: string; qod: number; latitude: number; longitude: number; }
export interface WxmObservation { timestamp: string; precipitationAccumulated?: number; }
export interface WxmStationDay { stationId: string; date: string; millimeters: number; }

export const WXM_API_BASE = "https://pro.weatherxm.com/api/v1";

interface WxmStationResponse { id: string; name?: string; lastDayQod?: number; location?: { lat: number; lon: number }; }
interface WxmHistoryResponse {
  date?: string;
  observations?: Array<{ timestamp: string; precipitation_accumulated?: number }>;
  health?: { data_quality?: { score?: number } };
}

/**
 * WeatherXM Pro client. WXM is a verification source only: NOAA remains the final
 * settlement value. All failures surface as DataUnavailableError; nothing is synthesized.
 */
export class WeatherXmClient {
  readonly name = "WeatherXM" as const;
  private readonly apiKey = process.env.WXM_API_KEY;

  configured(): boolean {
    return Boolean(this.apiKey);
  }

  /** Discover QoD-filtered stations around a city's NOAA station, per committed methodology. */
  async discoverStations(city: SkyHedgeCity): Promise<WxmStation[]> {
    this.requireKey();
    const station = NOAA_STATIONS[city];
    const spec = methodology.cities[city] as { wxmDiscovery?: { radiusKm?: number; minQod?: number; maxStations?: number } } | undefined;
    const radiusMeters = (spec?.wxmDiscovery?.radiusKm ?? 25) * 1000;
    const minQod = spec?.wxmDiscovery?.minQod ?? 0.8;
    const maxStations = spec?.wxmDiscovery?.maxStations ?? 10;

    const query = new URLSearchParams({ lat: String(station.latitude), lon: String(station.longitude), radius: String(radiusMeters) });
    const body = await this.get<WxmStationResponse[]>(`/stations/near?${query}`);
    return body
      .filter((candidate) => candidate.location && (candidate.lastDayQod ?? 0) >= minQod)
      .sort((a, b) => (b.lastDayQod ?? 0) - (a.lastDayQod ?? 0))
      .slice(0, maxStations)
      .map((candidate) => ({ id: candidate.id, name: candidate.name ?? candidate.id, qod: candidate.lastDayQod ?? 0, latitude: candidate.location!.lat, longitude: candidate.location!.lon }));
  }

  /** Cumulative rainfall per station over [start, end] (UTC dates), from precipitation-accumulated counters. */
  async stationRainfall(stationId: string, start: string, end: string): Promise<WxmStationDay[]> {
    this.requireKey();
    const days = this.datesInRange(start, end);
    const results: WxmStationDay[] = [];
    for (const day of days) {
      const body = await this.get<WxmHistoryResponse>(`/stations/${stationId}/history?date=${day}`);
      const observations = body.observations ?? [];
      const samples = observations
        .map((entry) => ({ timestamp: entry.timestamp, accumulated: entry.precipitation_accumulated }))
        .filter((sample): sample is { timestamp: string; accumulated: number } => typeof sample.accumulated === "number")
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      if (samples.length) results.push({ stationId, date: day, millimeters: sumAccumulated(samples.map((sample) => sample.accumulated)) });
    }
    return results;
  }

  /** Median daily rainfall across the discovered station set, per committed methodology. */
  async cityRainfall(city: SkyHedgeCity, start: string, end: string): Promise<{ stations: WxmStation[]; daily: WxmStationDay[]; cumulativeMm: number }> {
    const stations = await this.discoverStations(city);
    if (!stations.length) throw new DataUnavailableError(`WeatherXM has no QoD-qualified stations near ${city}`);
    const perStation = await Promise.all(stations.map((station) => this.stationRainfall(station.id, start, end)));
    const daily: WxmStationDay[] = [];
    for (const day of this.datesInRange(start, end)) {
      const values = perStation.flatMap((stationDays) => stationDays.filter((entry) => entry.date === day));
      const millimeters = median(values.map((entry) => entry.millimeters));
      if (values.length) daily.push({ stationId: values.map((entry) => entry.stationId).join("|"), date: day, millimeters });
    }
    return { stations, daily, cumulativeMm: daily.reduce((total, entry) => total + entry.millimeters, 0) };
  }

  private requireKey(): void {
    if (!this.apiKey) throw new DataUnavailableError("WXM_API_KEY is required for WeatherXM verification observations");
  }

  private async get<T>(path: string): Promise<T> {
    this.requireKey();
    let response: Response;
    try { response = await fetch(`${WXM_API_BASE}${path}`, { headers: { "X-API-KEY": this.apiKey! } }); }
    catch { throw new DataUnavailableError("WeatherXM request failed"); }
    if (response.status === 429) throw new DataUnavailableError("WeatherXM rate limit reached");
    if (!response.ok) throw new DataUnavailableError(`WeatherXM unavailable (${response.status})`);
    return response.json() as Promise<T>;
  }

  private datesInRange(start: string, end: string): string[] {
    const dates: string[] = [];
    const cursor = new Date(`${start}T00:00:00Z`);
    const last = new Date(`${end}T00:00:00Z`);
    while (cursor <= last) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
  }
}

export function sumAccumulated(samples: number[]): number {
  let total = 0;
  let previous = 0;
  for (const current of samples) {
    total += current >= previous ? current - previous : current;
    previous = current;
  }
  return round(total);
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}

function round(value: number): number { return Math.round(value * 100) / 100; }