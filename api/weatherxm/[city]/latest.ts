import type { IncomingMessage, ServerResponse } from "node:http";
import { WeatherXmProvider } from "../../../../server/services/weatherxm";
import { DataUnavailableError, NOAA_STATIONS, type SkyHedgeCity } from "../../../../server/services/noaa";
import { agriculturalMarketBySlug } from "../../../../shared/agricultural-markets";

/** Vercel serverless proxy: keeps the WeatherXM Pro key off the public SPA. */
export default async function handler(req: IncomingMessage & { query?: Record<string, string | string[]> }, res: ServerResponse & { status: (code: number) => ServerResponse; json: (body: unknown) => void }) {
  const city = req.query?.city;
  const value = Array.isArray(city) ? city[0] : city;
  if (!value || (!(value in NOAA_STATIONS) && !agriculturalMarketBySlug(value))) return res.status(400).json({ error: "UNKNOWN_MARKET_LOCATION" });
  try {
    const data = await new WeatherXmProvider().latest(value as SkyHedgeCity);
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "WeatherXM request failed";
    return res.status(error instanceof DataUnavailableError ? 503 : 500).json({ error: "DATA_UNAVAILABLE", message, settlementEligible: false });
  }
}
