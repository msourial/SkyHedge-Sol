import type { IncomingMessage, ServerResponse } from "node:http";
import { PublicKey } from "@solana/web3.js";
import { AGRICULTURAL_MARKETS, calendarMonthlyWindow, weeklyFridayWindow } from "../../shared/agricultural-markets.js";
import { cityBySlug } from "../../shared/cities.js";
import { allCityIndexStates, cityIndexState, weeklyHistory } from "./weather-index.js";

type ApiRequest = IncomingMessage & { query?: Record<string, unknown> };
type ApiResponse = ServerResponse & {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

function queryValue(req: ApiRequest, key: string): string | undefined {
  const value = req.query?.[key];
  if (typeof value === "string") return value;
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : undefined;
}

export function createMobileApiHandler(dependencies: {
  loadCities?: typeof allCityIndexStates;
  resolveCity?: typeof cityBySlug;
  readCity?: typeof cityIndexState;
  readHistory?: typeof weeklyHistory;
  now?: () => Date;
} = {}) {
  const loadCities = dependencies.loadCities ?? allCityIndexStates;
  const resolveCity = dependencies.resolveCity ?? cityBySlug;
  const readCity = dependencies.readCity ?? cityIndexState;
  const readHistory = dependencies.readHistory ?? weeklyHistory;

  return async function mobileApiHandler(req: ApiRequest, res: ApiResponse) {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "METHOD_NOT_ALLOWED", message: "Use GET for mobile read APIs." });
    }
    const resource = queryValue(req, "resource");
    try {
      if (resource === "cities") {
        const cities = await loadCities();
        res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=60");
        return res.status(200).json({ cities });
      }

      if (resource === "city") {
        const slug = queryValue(req, "slug");
        if (!slug || !/^[a-z0-9-]{2,32}$/.test(slug)) {
          return res.status(400).json({ error: "INVALID_CITY", message: "A valid city slug is required." });
        }
        const city = resolveCity(slug);
        if (!city) return res.status(404).json({ error: "UNKNOWN_CITY", message: `No NOAA index is listed for ${slug}.` });
        const state = await readCity(slug);
        if (!state) return res.status(404).json({ error: "UNKNOWN_CITY", message: `No NOAA index is listed for ${slug}.` });
        let history: Awaited<ReturnType<typeof readHistory>> = null;
        try { history = await readHistory(city); } catch { history = null; }
        res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=60");
        return res.status(200).json({ ...state, weeklyHistoryMm: history });
      }

      if (resource === "agricultural-markets") {
        const now = dependencies.now?.() ?? new Date();
        res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=300");
        return res.status(200).json({
          metric: "cumulative_rainfall_mm",
          settlementSource: "NOAA",
          collateralStatus: "USD_PREVIEW_ONLY",
          windows: { weekly: weeklyFridayWindow(now), monthly: calendarMonthlyWindow(now) },
          markets: AGRICULTURAL_MARKETS,
        });
      }

      if (resource === "portfolio") {
        const wallet = queryValue(req, "wallet");
        let canonicalWallet: string;
        try {
          if (!wallet) throw new Error("Missing wallet");
          canonicalWallet = new PublicKey(wallet).toBase58();
        } catch {
          return res.status(400).json({ error: "INVALID_WALLET", message: "A valid Solana wallet address is required." });
        }
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({
          wallet: canonicalWallet,
          source: "not-indexed",
          indexed: false,
          protections: [],
          liquidity: [],
          message: "Finalized portfolio positions are not indexed on this deployment yet. An empty list is not proof that the wallet has no on-chain positions.",
        });
      }

      return res.status(404).json({ error: "UNKNOWN_MOBILE_RESOURCE", message: "That mobile read resource is not available." });
    } catch {
      res.setHeader("Cache-Control", "no-store");
      return res.status(503).json({ error: "MOBILE_READ_UNAVAILABLE", message: "The requested SkyHedge data is temporarily unavailable." });
    }
  };
}
