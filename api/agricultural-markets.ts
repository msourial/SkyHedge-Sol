import type { IncomingMessage, ServerResponse } from "node:http";
import { AGRICULTURAL_MARKETS, calendarMonthlyWindow, weeklyFridayWindow } from "../shared/agricultural-markets.js";

type ApiResponse = ServerResponse & {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

export function createAgriculturalMarketsHandler(options: { now?: () => Date } = {}) {
  return function agriculturalMarketsHandler(req: IncomingMessage, res: ApiResponse) {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "METHOD_NOT_ALLOWED", message: "Use GET for the agricultural research catalog." });
    }
    const now = options.now?.() ?? new Date();
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=300");
    return res.status(200).json({
      metric: "cumulative_rainfall_mm",
      settlementSource: "NOAA",
      collateralStatus: "USD_PREVIEW_ONLY",
      windows: { weekly: weeklyFridayWindow(now), monthly: calendarMonthlyWindow(now) },
      markets: AGRICULTURAL_MARKETS,
    });
  };
}

export default createAgriculturalMarketsHandler();
