import type { IncomingMessage, ServerResponse } from "node:http";
import { allCityIndexStates } from "../server/services/weather-index.js";

type ApiResponse = ServerResponse & {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

export function createCityListHandler(load = allCityIndexStates) {
  return async function cityListHandler(req: IncomingMessage, res: ApiResponse) {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "METHOD_NOT_ALLOWED", message: "Use GET for city indexes." });
    }
    try {
      const cities = await load();
      res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=60");
      return res.status(200).json({ cities });
    } catch {
      res.setHeader("Cache-Control", "no-store");
      return res.status(503).json({ error: "CITY_INDEX_UNAVAILABLE", message: "NOAA city-index data is temporarily unavailable." });
    }
  };
}

export default createCityListHandler();
