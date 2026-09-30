import type { IncomingMessage, ServerResponse } from "node:http";
import { cityBySlug } from "../../shared/cities.js";
import { cityIndexState, weeklyHistory } from "../../server/services/weather-index.js";

type ApiRequest = IncomingMessage & { query?: Record<string, string | string[]> };
type ApiResponse = ServerResponse & {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

type CityRouteDependencies = {
  resolveCity: typeof cityBySlug;
  readState: typeof cityIndexState;
  readHistory: typeof weeklyHistory;
};

const defaults: CityRouteDependencies = {
  resolveCity: cityBySlug,
  readState: cityIndexState,
  readHistory: weeklyHistory,
};

export function createCityDetailHandler(dependencies: Partial<CityRouteDependencies> = {}) {
  const { resolveCity, readState, readHistory } = { ...defaults, ...dependencies };
  return async function cityDetailHandler(req: ApiRequest, res: ApiResponse) {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "METHOD_NOT_ALLOWED", message: "Use GET for city-index details." });
    }
    const value = req.query?.slug;
    const slug = Array.isArray(value) ? value[0] : value;
    if (!slug || !/^[a-z0-9-]{2,32}$/.test(slug)) {
      return res.status(400).json({ error: "INVALID_CITY", message: "A valid city slug is required." });
    }
    const city = resolveCity(slug);
    if (!city) return res.status(404).json({ error: "UNKNOWN_CITY", message: `No NOAA index is listed for ${slug}.` });

    try {
      const state = await readState(slug);
      if (!state) return res.status(404).json({ error: "UNKNOWN_CITY", message: `No NOAA index is listed for ${slug}.` });
      let history: Awaited<ReturnType<typeof readHistory>> = null;
      try { history = await readHistory(city); } catch { history = null; }
      res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=60");
      return res.status(200).json({ ...state, weeklyHistoryMm: history });
    } catch {
      res.setHeader("Cache-Control", "no-store");
      return res.status(503).json({ error: "CITY_INDEX_UNAVAILABLE", message: "NOAA city-index data is temporarily unavailable." });
    }
  };
}

export default function cityDetail(req: ApiRequest, res: ApiResponse) {
  return createCityDetailHandler()(req, res);
}
