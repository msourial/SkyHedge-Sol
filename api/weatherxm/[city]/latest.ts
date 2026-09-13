import type { IncomingMessage, ServerResponse } from "node:http";

type JsonResponse = ServerResponse & {
  status: (code: number) => JsonResponse;
  json: (body: unknown) => void;
};

const WEATHERXM_AGENT_BASE_URL = (process.env.WEATHERXM_AGENT_BASE_URL ?? "https://agent.weatherxm.com").replace(/\/$/, "");

const LOCATIONS: Record<string, { latitude: number; longitude: number }> = {
  "new-york": { latitude: 40.7128, longitude: -74.006 },
  miami: { latitude: 25.7617, longitude: -80.1918 },
  chicago: { latitude: 41.8781, longitude: -87.6298 },
  "des-moines": { latitude: 41.5868, longitude: -93.625 },
  fresno: { latitude: 36.7378, longitude: -119.7871 },
  lubbock: { latitude: 33.5779, longitude: -101.8552 },
  winnipeg: { latitude: 49.8951, longitude: -97.1384 },
  cordoba: { latitude: -31.4201, longitude: -64.1888 },
  sorriso: { latitude: -12.5425, longitude: -55.7211 },
  asuncion: { latitude: -25.2637, longitude: -57.5759 },
  "santa-cruz": { latitude: -17.7833, longitude: -63.1821 },
  ludhiana: { latitude: 30.901, longitude: 75.8573 },
  nagpur: { latitude: 21.1458, longitude: 79.0882 },
  eldoret: { latitude: 0.5143, longitude: 35.2698 },
  arusha: { latitude: -3.3869, longitude: 36.683 },
};

function sendJson(res: JsonResponse, status: number, body: unknown) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(body);
}

export default async function handler(req: IncomingMessage & { query?: Record<string, string | string[]> }, res: JsonResponse) {
  const city = req.query?.city;
  const value = Array.isArray(city) ? city[0] : city;
  if (!value || !LOCATIONS[value]) return sendJson(res, 400, { error: "UNKNOWN_MARKET_LOCATION" });

  try {
    const healthResponse = await fetch(`${WEATHERXM_AGENT_BASE_URL}/api/health`);
    if (!healthResponse.ok) {
      return sendJson(res, 503, { error: "DATA_UNAVAILABLE", message: `WeatherXM Agent API unavailable (${healthResponse.status})`, settlementEligible: false });
    }
    let health: unknown = null;
    try { health = await healthResponse.json(); } catch { health = null; }
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return sendJson(res, 200, {
      source: "WeatherXM",
      settlementEligible: false,
      city: value,
      location: LOCATIONS[value],
      agent: {
        baseUrl: WEATHERXM_AGENT_BASE_URL,
        health,
        freeEndpoint: "/api/health",
        paidEndpoints: ["/api/current", "/api/forecast", "/api/history"],
        paymentProtocol: "x402",
        priceUsdPerRequest: "0.001",
      },
      status: "AGENT_HEALTH_OK_OBSERVATIONS_PAID",
      message: "WeatherXM Agent API is reachable. Live current, forecast, and history calls require x402 payment and are not used for SkyHedge settlement.",
    });
  } catch {
    return sendJson(res, 503, { error: "DATA_UNAVAILABLE", message: "WeatherXM Agent API health check failed", settlementEligible: false });
  }
}
