import { DataUnavailableError, NOAA_STATIONS, type SkyHedgeCity } from "./noaa";

/**
 * Supplemental, read-only WeatherXM evidence. NOAA remains the only V1
 * settlement authority and this class must never provide a fallback result.
 */
export class WeatherXmProvider {
  private readonly key = process.env.WEATHERXM_API_KEY;

  async latest(city: SkyHedgeCity) {
    if (!this.key) throw new DataUnavailableError("WEATHERXM_API_KEY is not configured");
    const point = NOAA_STATIONS[city];
    const epsilon = 0.08;
    const query = new URLSearchParams({
      min_lat: String(point.latitude - epsilon), min_lon: String(point.longitude - epsilon),
      max_lat: String(point.latitude + epsilon), max_lon: String(point.longitude + epsilon),
    });
    let stationsResponse: Response;
    try {
      stationsResponse = await fetch(`https://pro.weatherxm.com/api/v1/stations/bounds?${query}`, { headers: { "X-API-KEY": this.key } });
    } catch { throw new DataUnavailableError("WeatherXM station lookup failed"); }
    if (!stationsResponse.ok) throw new DataUnavailableError(`WeatherXM station lookup unavailable (${stationsResponse.status})`);
    const stationsBody = await stationsResponse.json() as { stations?: Array<{ id: string; name?: string; location?: { lat?: number; lon?: number }; lastDayQod?: number }> };
    const station = stationsBody.stations?.[0];
    if (!station?.id) throw new DataUnavailableError("WeatherXM has no station near this NOAA-pinned market");
    let observationResponse: Response;
    try { observationResponse = await fetch(`https://pro.weatherxm.com/api/v1/stations/${station.id}/latest`, { headers: { "X-API-KEY": this.key } }); }
    catch { throw new DataUnavailableError("WeatherXM latest-observation request failed"); }
    if (!observationResponse.ok) throw new DataUnavailableError(`WeatherXM latest observation unavailable (${observationResponse.status})`);
    const body = await observationResponse.json() as { observation?: { timestamp?: string; precipitation_rate?: number; precipitation_accumulated?: number; temperature?: number; humidity?: number }; health?: { data_quality?: { score?: number } } };
    if (!body.observation?.timestamp) throw new DataUnavailableError("WeatherXM returned no current observation");
    return {
      source: "WeatherXM" as const, settlementEligible: false,
      city, station: { id: station.id, name: station.name ?? null, latitude: station.location?.lat ?? null, longitude: station.location?.lon ?? null, lastDayQuality: station.lastDayQod ?? null },
      observation: { timestamp: body.observation.timestamp, precipitationRate: body.observation.precipitation_rate ?? null, precipitationAccumulated: body.observation.precipitation_accumulated ?? null, temperature: body.observation.temperature ?? null, humidity: body.observation.humidity ?? null, dataQuality: body.health?.data_quality?.score ?? null },
    };
  }
}
