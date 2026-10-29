import type { IncomingMessage, ServerResponse } from "node:http";
import { PublicKey } from "@solana/web3.js";
import { AGRICULTURAL_MARKETS, calendarMonthlyWindow, weeklyFridayWindow } from "../../shared/agricultural-markets.js";
import { cityBySlug } from "../../shared/cities.js";
import { createClaimReadinessHandler, type ApiRequest as ClaimRequest, type ApiResponse as ClaimResponse } from "./vercel-api.js";
import type { ClaimReadiness } from "./unsigned-tx.js";
import { allCityIndexStates, cityIndexState, weeklyHistory } from "./weather-index.js";
import { applyCorsHeaders } from "./cors.js";
import { isPerilId } from "../../shared/perils.js";
import { marketsForWindowQuote, readCatalogueWindowQuote } from "./window-quote-read.js";
import { DevnetStatusReader } from "./devnet-status.js";
import { readCoverProgress } from "./cover-progress.js";
import { readForecastEdge } from "./forecast-exceedance.js";
import type { WindowQuote } from "../../shared/ui-quote-types.js";

type ApiRequest = IncomingMessage & { query?: Record<string, unknown> };
type ApiResponse = ServerResponse & {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

/** One reader per warm instance, so concurrent quote reads share its in-flight status read and cache. */
let sharedStatusReader: DevnetStatusReader | null = null;
export function sharedDevnetStatusReader(): DevnetStatusReader {
  sharedStatusReader ??= new DevnetStatusReader();
  return sharedStatusReader;
}

function queryValue(req: ApiRequest, key: string): string | undefined {
  const value = req.query?.[key];
  if (typeof value === "string") return value;
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : undefined;
}

export function createMobileApiHandler(dependencies: {
  readCoverProgress?: typeof readCoverProgress;
  readForecastEdge?: typeof readForecastEdge;
  loadCities?: typeof allCityIndexStates;
  resolveCity?: typeof cityBySlug;
  readCity?: typeof cityIndexState;
  readHistory?: typeof weeklyHistory;
  now?: () => Date;
  readWalletState?: (wallet: string) => Promise<unknown>;
  readPortfolio?: (wallet: string) => Promise<unknown[]>;
  readClaimReadiness?: (market: string, wallet: string) => Promise<ClaimReadiness>;
  readWindowQuote?: (query: { peril: string; cityId: string; windowStart: string; windowEnd: string }) => Promise<WindowQuote>;
} = {}) {
  const loadCities = dependencies.loadCities ?? allCityIndexStates;
  const resolveCity = dependencies.resolveCity ?? cityBySlug;
  const readCity = dependencies.readCity ?? cityIndexState;
  const readHistory = dependencies.readHistory ?? weeklyHistory;

  return async function mobileApiHandler(req: ApiRequest, res: ApiResponse) {
    applyCorsHeaders(req, res);
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "METHOD_NOT_ALLOWED", message: "Use GET for mobile read APIs." });
    }
    const resource = queryValue(req, "resource");
    try {
      if (resource === "cover-progress" || resource === "forecast-edge") {
        const single = queryValue(req, "market");
        const batch = queryValue(req, "markets");
        const addresses = (single ?? batch ?? "").split(",");
        if ((single && batch) || addresses.length > 20 || addresses.some((address) => {
          try { return new PublicKey(address).toBase58() !== address; } catch { return true; }
        })) return res.status(400).json({ error: "INVALID_MARKETS", message: "Supply market or markets with 1–20 valid Solana addresses." });
        const unique = [...new Set(addresses)];
        // A bad account/RPC read is a 503, not a fabricated observation or zero chance.
        const read = resource === "cover-progress" ? (dependencies.readCoverProgress ?? readCoverProgress) : (dependencies.readForecastEdge ?? readForecastEdge);
        const entries = await Promise.all(unique.map(async (address) => [address, await read(address)] as const));
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({ [resource === "cover-progress" ? "progress" : "edges"]: Object.fromEntries(entries) });
      }

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
        const read = dependencies.readPortfolio ?? (async (address: string) => {
          const { readFinalizedProtections } = await import("../../shared/positions-reader.ts");
          return readFinalizedProtections(address);
        });
        const protections = await read(canonicalWallet);
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({
          wallet: canonicalWallet,
          source: "finalized-solana-rpc",
          indexed: true,
          protections,
          liquidity: [],
        });
      }

      if (resource === "wallet-balances") {
        const wallet = queryValue(req, "wallet");
        let canonicalWallet: string;
        try {
          if (!wallet) throw new Error("Missing wallet");
          canonicalWallet = new PublicKey(wallet).toBase58();
        } catch {
          return res.status(400).json({ error: "INVALID_WALLET", message: "A valid Solana wallet address is required." });
        }
        const read = dependencies.readWalletState ?? (async (address: string) => {
          const { readFinalizedWalletState } = await import("../../shared/wallet-reader.ts");
          return readFinalizedWalletState(address);
        });
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json(await read(canonicalWallet));
      }

      if (resource === "window-quote") {
        const cityId = queryValue(req, "city") ?? queryValue(req, "cityId");
        const peril = queryValue(req, "peril") ?? "rain";
        const windowStart = queryValue(req, "observationStart") ?? queryValue(req, "windowStart");
        const windowEnd = queryValue(req, "observationEnd") ?? queryValue(req, "windowEnd");
        if (!cityId || !windowStart || !windowEnd || !isPerilId(peril)) {
          return res.status(400).json({ error: "INVALID_WINDOW_QUOTE", message: "city, peril, observationStart, and observationEnd are required." });
        }
        const read = dependencies.readWindowQuote ?? (async (query: { peril: string; cityId: string; windowStart: string; windowEnd: string }) => {
          const reader = sharedDevnetStatusReader();
          if (!isPerilId(query.peril)) throw Object.assign(new Error("Unknown peril."), { code: "DATA_UNAVAILABLE" });
          const markets = await marketsForWindowQuote(() => reader.read(), query.cityId, query.peril, query.windowStart, query.windowEnd);
          return readCatalogueWindowQuote({ ...query, markets });
        });
        try {
          res.setHeader("Cache-Control", "no-store");
          return res.status(200).json(await read({ peril, cityId, windowStart, windowEnd }));
        } catch (error) {
          const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
          const message = error instanceof Error ? error.message : "The window quote could not be prepared.";
          if (code === "PERIL_NOT_OPEN" || code === "PERIL_NOT_AVAILABLE") return res.status(409).json({ error: code, message });
          return res.status(503).json({ error: "DATA_UNAVAILABLE", message });
        }
      }

      if (resource === "claim-readiness") {
        const read = dependencies.readClaimReadiness ?? (async (market: string, wallet: string) => {
          const { UnsignedTransactionBuilder } = await import("./unsigned-tx.js");
          return new UnsignedTransactionBuilder().readClaimReadiness(market, wallet);
        });
        const claimReq = Object.assign(req, { query: { market: queryValue(req, "market"), wallet: queryValue(req, "wallet") } });
        return createClaimReadinessHandler({ read })(claimReq as unknown as ClaimRequest, res as unknown as ClaimResponse);
      }

      return res.status(404).json({ error: "UNKNOWN_MOBILE_RESOURCE", message: "That mobile read resource is not available." });
    } catch {
      res.setHeader("Cache-Control", "no-store");
      return res.status(503).json({ error: "MOBILE_READ_UNAVAILABLE", message: "The requested SkyHedge data is temporarily unavailable." });
    }
  };
}
