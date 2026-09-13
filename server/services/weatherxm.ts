import { agriculturalMarketBySlug, type AgriculturalMarketSlug } from "../../shared/agricultural-markets";
import { DataUnavailableError, NOAA_STATIONS, type SkyHedgeCity } from "./noaa";

type WeatherContext = SkyHedgeCity | AgriculturalMarketSlug;

function coordinatesFor(context: WeatherContext): { latitude: number; longitude: number } {
  const agricultural = agriculturalMarketBySlug(context);
  if (agricultural) return agricultural;
  const station = NOAA_STATIONS[context as SkyHedgeCity];
  if (!station) throw new DataUnavailableError("Unknown WeatherXM market location");
  return station;
}

/**
 * Supplemental, read-only WeatherXM evidence. NOAA remains the only V1
 * settlement authority and this class must never provide a fallback result.
 */
export class WeatherXmProvider {
  private readonly baseUrl = (process.env.WEATHERXM_AGENT_BASE_URL ?? "https://agent.weatherxm.com").replace(/\/$/, "");

  async context(city: WeatherContext) {
    const point = coordinatesFor(city);

    let healthResponse: Response;
    try {
      healthResponse = await fetch(`${this.baseUrl}/api/health`);
    } catch {
      throw new DataUnavailableError("WeatherXM Agent API health check failed");
    }
    if (!healthResponse.ok) throw new DataUnavailableError(`WeatherXM Agent API unavailable (${healthResponse.status})`);

    let health: unknown = null;
    try { health = await healthResponse.json(); } catch { health = null; }

    return {
      source: "WeatherXM" as const, settlementEligible: false,
      city,
      location: { latitude: point.latitude, longitude: point.longitude },
      agent: {
        baseUrl: this.baseUrl,
        health,
        freeEndpoint: "/api/health",
        paidEndpoints: ["/api/current", "/api/forecast", "/api/history"],
        paymentProtocol: "x402",
        priceUsdPerRequest: "0.001",
      },
      status: "AGENT_HEALTH_OK_OBSERVATIONS_PAID" as const,
      message: "WeatherXM Agent API is reachable. Live current, forecast, and history calls require x402 payment and are not used for SkyHedge settlement.",
    };
  }
}
