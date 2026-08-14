import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { Express, Response } from "express";
import { z } from "zod";
import { DataUnavailableError, NOAA_STATIONS, NoaaRainfallProvider, canonicalSourceHash, cumulativeMillimeters, type SkyHedgeCity } from "./services/noaa";
import { MARKET_LIMITS, RainfallQuoteEngine, type TriggerOperator } from "./services/quote-engine";
import { resolveNetworkIdentity } from "./services/solana-network";

const provider = new NoaaRainfallProvider();
const quotes = new RainfallQuoteEngine(provider);
const programId = "HY3EyQW3qvZfqWPHn5nwUfY5FwHTFxTzVgjntG8ERCEK";
const citySchema = z.enum(["new-york", "miami", "chicago"]);
const quoteSchema = z.object({ city: citySchema, observationStart: z.string().date(), observationEnd: z.string().date(), thresholdMm: z.number().positive(), operator: z.enum(["gt", "gte", "lt", "lte"]), protectedAmount: z.string().regex(/^\d+$/) });

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/health", async (_req, res) => {
    const identity = await resolveNetworkIdentity(programId);
    res.json({ name: "SkyHedge", ...identity, settlementSource: "NOAA", generatedData: false });
  });

  app.get("/api/markets", (_req, res) => res.json(Object.entries(NOAA_STATIONS).map(([id, station]) => ({ id, ...station, metric: "cumulative_rainfall_mm", collateral: "SKYT", decimals: 6, status: "INDEXER_PENDING", maxLiquidity: MARKET_LIMITS.maxLiquidity.toString(), maxExposure: MARKET_LIMITS.maxExposure.toString(), perWalletMax: MARKET_LIMITS.perWallet.toString(), programId }))));

  app.get("/api/weather/:city", async (req, res) => {
    const city = citySchema.safeParse(req.params.city);
    const range = z.object({ start: z.string().date(), end: z.string().date() }).safeParse(req.query);
    if (!city.success || !range.success) return res.status(400).json({ error: "city, start, and end are required" });
    try {
      const records = await provider.dailyRainfall(NOAA_STATIONS[city.data].stationId, range.data.start, range.data.end);
      const cumulativeMm = cumulativeMillimeters(records);
      return res.json({ source: "NOAA", city: city.data, stationId: NOAA_STATIONS[city.data].stationId, start: range.data.start, end: range.data.end, records, cumulativeMm, sourceHash: canonicalSourceHash({ city: city.data, records }) });
    } catch (error) { return dataUnavailable(res, error); }
  });

  app.post("/api/quotes", async (req, res) => {
    const parsed = quoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid protection parameters", details: parsed.error.flatten() });
    try {
      const request = parsed.data;
      const quote = await quotes.quote({ ...request, stationId: NOAA_STATIONS[request.city].stationId, protectedAmount: BigInt(request.protectedAmount), operator: request.operator as TriggerOperator });
      return res.json({ ...quote, premium: quote.premium.toString(), protocolFee: quote.protocolFee.toString(), protectedAmount: request.protectedAmount, source: "NOAA", explicitApprovalRequired: true });
    } catch (error) { return dataUnavailable(res, error); }
  });

  app.post("/api/advisory", (req, res) => {
    const input = z.object({ city: citySchema, risk: z.enum(["excess-rain", "low-rain"]), thresholdMm: z.number().positive(), protectedAmount: z.string().regex(/^\d+$/) }).safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: "Please provide a supported city, risk, threshold, and SKYT amount." });
    const operator: TriggerOperator = input.data.risk === "excess-rain" ? "gte" : "lte";
    const sessionId = randomUUID();
    return res.json({ sessionId, structuredParameters: { ...input.data, operator }, recommendation: { city: input.data.city, stationId: NOAA_STATIONS[input.data.city].stationId, methodology: "NOAA cumulative rainfall; a quote is required before any transaction can be prepared." }, reasoning: "SkyHedge matches only the selected city’s immutable NOAA cumulative-rainfall market. This advisory does not execute, sign, or settle a transaction.", explicitApprovalRequired: true });
  });

  app.get("/api/portfolio/:wallet", (req, res) => res.json({ wallet: req.params.wallet, source: "finalized-chain-indexer", indexed: false, positions: [], message: "No portfolio is shown until finalized Solana state has been indexed; SkyHedge never substitutes mock positions." }));

  app.post("/api/transactions/unsigned", (req, res) => {
    const intent = z.object({ action: z.enum(["fund_pool", "withdraw_liquidity", "open_position", "claim_payout", "claim_premium_refund", "redeem_closed_liquidity"]), market: z.string().min(32), wallet: z.string().min(32), amount: z.string().regex(/^\d+$/).optional(), approved: z.literal(true) }).safeParse(req.body);
    if (!intent.success) return res.status(400).json({ error: "A valid market, wallet, and explicit approval are required." });
    return res.status(501).json({ error: "PROGRAM_IDL_REQUIRED", message: "The API will serialize this wallet-signed transaction only after a deployed program and its generated Anchor IDL are registered. No simulated transaction is returned.", intent: intent.data, programId, network: "devnet" });
  });

  return createServer(app);
}

function dataUnavailable(res: Response, error: unknown) {
  if (error instanceof DataUnavailableError) return res.status(503).json({ error: error.code, message: error.message, settlementAction: "Do not synthesize a value; mark the market DATA_UNAVAILABLE after its on-chain deadline." });
  return res.status(500).json({ error: "WEATHER_SERVICE_ERROR", message: "Weather data could not be processed." });
}
