import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { Express, Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { DataUnavailableError, NOAA_STATIONS, NoaaRainfallProvider, canonicalSourceHash, cumulativeMillimeters, type SkyHedgeCity } from "./services/noaa";
import { searchCities } from "./services/city-index";
import { MARKET_LIMITS, RainfallQuoteEngine, type TriggerOperator } from "./services/quote-engine";
import { RainfallConsensusService } from "./services/consensus";
import { createDb } from "./db";
import { settlementEvidence, markets as marketsTable, protectionPositions as protectionPositionsTable, liquidityPositions as liquidityPositionsTable } from "../shared/schema";
import { cityHash, CITY_INDEX, cityBySlug, windowNormalMm, upcomingWeeklyWindows, type CityIndex } from "../shared/cities";
import { cityIndexState, allCityIndexStates, weeklyHistory } from "./services/weather-index";
import { buildChainGrid } from "./services/chain-view";
import { advisorChat } from "./services/ai-advisor";
import { aiAccuracy, aiInsights, portfolioStats, stakingPools, stakingUser } from "./services/dashboard-stats";
import { GovernanceStore } from "./services/governance";
import { AnchorIndexer } from "./services/solana-indexer";
import { UnsignedTransactionBuilder, type TxAction } from "./services/unsigned-tx";
import { SettlementRunner } from "./services/settlement";

const provider = new NoaaRainfallProvider();
const quotes = new RainfallQuoteEngine(provider);
const consensus = new RainfallConsensusService();
const db = createDb();
const indexer = new AnchorIndexer(db);
const unsignedTx = new UnsignedTransactionBuilder();
const settlement = new SettlementRunner(db);
const programId = "7thTyPBaVCEBL2z28ojTxfmrbNMydXV3EAgbYgrz7GKr";
const governance = new GovernanceStore();
const citySchema = z.enum(Object.keys(NOAA_STATIONS) as [SkyHedgeCity, ...SkyHedgeCity[]]);
const quoteSchema = z.object({ city: citySchema, observationStart: z.string().date(), observationEnd: z.string().date(), thresholdMm: z.number().positive(), operator: z.enum(["gt", "gte", "lt", "lte"]), protectedAmount: z.string().regex(/^\d+$/) });

export async function registerRoutes(app: Express): Promise<Server> {
  const limiter = new RateLimiter(60, 30); // 30 requests per 60s per key

  app.get("/api/health", (_req, res) => res.json({ name: "SkyHedge", network: process.env.SOLANA_NETWORK ?? "devnet", programId, settlementSource: "NOAA+WeatherXM", generatedData: false }));

  app.get("/api/cities/search", (req, res) => {
    const q = z.string().min(1).max(64).safeParse(req.query.q);
    if (!q.success) return res.status(400).json({ error: "a non-empty q query parameter is required" });
    res.json({ query: q.data, results: searchCities(q.data) });
  });

  app.get("/api/markets", async (_req, res) => {
    try {
      const rows = await db.select().from(marketsTable);
      const enriched = rows.map((row) => {
        const metadata = row.metadata as Record<string, unknown>;
        const hexToBigInt = (v: unknown): bigint => {
          if (typeof v === "string" && /^[0-9a-f]+$/i.test(v)) return BigInt(`0x${v}`);
          return BigInt(String(v ?? 0));
        };
        const cityHashHex = Array.isArray(metadata?.city_hash) ? Buffer.from(metadata.city_hash as number[]).toString("hex") : "";
        const city = Object.keys(NOAA_STATIONS).find((slug) => cityHash(slug) === cityHashHex) ?? "unknown";
        return {
          id: row.address,
          marketId: row.marketId.toString(),
          city,
          stationId: metadata?.station_id_hash ? "committed" : "committed",
          status: JSON.stringify(metadata?.status ?? {}),
          result: JSON.stringify(metadata?.result ?? {}),
          thresholdMmX100: hexToBigInt(metadata?.threshold_mm_x100).toString(),
          premiumRateBps: Number(hexToBigInt(metadata?.premium_rate_bps)),
          totalShares: hexToBigInt(metadata?.total_shares).toString(),
          reservedExposure: hexToBigInt(metadata?.reserved_exposure).toString(),
          salesCloseAt: Number(hexToBigInt(metadata?.sales_close_at)),
          observationStart: Number(hexToBigInt(metadata?.observation_start)),
          observationEnd: Number(hexToBigInt(metadata?.observation_end)),
          maxLiquidity: hexToBigInt(metadata?.max_liquidity).toString(),
          maxExposure: hexToBigInt(metadata?.max_exposure).toString(),
          perWalletMax: hexToBigInt(metadata?.per_wallet_max).toString(),
          collateral: "SKYT",
          decimals: 6,
          programId,
          indexed: true,
        };
      });
      if (!enriched.length) return res.json(Object.entries(NOAA_STATIONS).map(([id, station]) => ({ id, ...station, metric: "cumulative_rainfall_mm", collateral: "SKYT", decimals: 6, status: "INDEXER_PENDING", maxLiquidity: MARKET_LIMITS.maxLiquidity.toString(), maxExposure: MARKET_LIMITS.maxExposure.toString(), perWalletMax: MARKET_LIMITS.perWallet.toString(), programId })));
      enriched.sort((a, b) => a.city.localeCompare(b.city));
      return res.json(enriched);
    } catch (error) { return dataUnavailable(res, error); }
  });

  app.post("/api/indexer/reconcile", async (_req, res) => {
    try {
      const result = await indexer.reconcile();
      return res.json({ ok: true, toSlot: result.toSlot.toString(), events: result.events, accounts: result.accounts });
    } catch (error) { return res.status(500).json({ error: "INDEXER_ERROR", message: (error as Error).message }); }
  });

  app.post("/api/settlement/run", async (_req, res) => {
    try {
      const result = await settlement.runOnce();
      return res.json({ ok: true, ...result });
    } catch (error) { return res.status(500).json({ error: "SETTLEMENT_ERROR", message: (error as Error).message }); }
  });

  app.get("/api/weather/:city", async (req, res) => {
    if (!limiter.allow(req.ip ?? "unknown")) return res.status(429).json({ error: "RATE_LIMITED", message: "Too many requests; try again shortly." });
    
    const city = citySchema.safeParse(req.params.city);
    const range = z.object({ start: z.string().date(), end: z.string().date() }).safeParse(req.query);
    if (!city.success || !range.success) return res.status(400).json({ error: "city, start, and end are required" });
    try {
      const result = await consensus.evidenceFor(city.data, range.data.start, range.data.end);
      if (result.verdict !== "DATA_UNAVAILABLE") {
        await db.insert(settlementEvidence).values({
          sourceHash: result.evidence.sourceHash,
          city: result.evidence.city,
          windowStart: result.evidence.windowStart,
          windowEnd: result.evidence.windowEnd,
          methodologyVersion: result.evidence.methodologyVersion,
          verdict: result.evidence.verdict,
          noaaMm: String(result.evidence.noaa.cumulativeMm),
          wxmMm: result.evidence.wxm.cumulativeMm === null ? null : String(result.evidence.wxm.cumulativeMm),
          deltaMm: result.evidence.deltaMm === null ? null : String(result.evidence.deltaMm),
          toleranceMm: result.evidence.toleranceMm === null ? null : String(result.evidence.toleranceMm),
          evidence: result.evidence,
        }).onConflictDoNothing();
      }
      return res.json({ ...result.evidence, finalValueMm: result.finalValueMm });
    } catch (error) { return dataUnavailable(res, error); }
  });

  app.get("/api/cities", async (_req, res) => {
    try {
      const states = await allCityIndexStates();
      return res.json({ cities: states });
    } catch (error) { return dataUnavailable(res, error); }
  });

  app.get("/api/cities/:slug", async (req, res) => {
    const slug = z.string().min(2).max(32).safeParse(req.params.slug);
    if (!slug.success) return res.status(400).json({ error: "a city slug is required" });
    const state = await cityIndexState(slug.data);
    if (!state) return res.status(404).json({ error: "UNKNOWN_CITY", message: `no index for "${slug.data}"` });
    const city = cityBySlug(slug.data)!;
    let history: Array<{ week: string; mm: number | null }> | null = null;
    try { history = await weeklyHistory(city); } catch { history = null; }
    return res.json({ ...state, weeklyHistoryMm: history });
  });

  app.get("/api/cities/:slug/chain", async (req, res) => {
    const slug = z.string().min(2).max(32).safeParse(req.params.slug);
    if (!slug.success) return res.status(400).json({ error: "a city slug is required" });
    const grid = await buildChainGrid(slug.data);
    if (!grid) return res.status(404).json({ error: "UNKNOWN_CITY", message: `no index for "${slug.data}"` });
    return res.json(grid);
  });

  app.get("/api/markets/:id/evidence", async (req, res) => {
    const id = z.string().min(32).safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: "a market address is required" });
    try {
      const rows = await db.select().from(settlementEvidence).where(eq(settlementEvidence.marketAddress, id.data)).orderBy(settlementEvidence.createdAt);
      return res.json({ market: id.data, evidence: rows.map((row) => ({ sourceHash: row.sourceHash, verdict: row.verdict, noaaMm: row.noaaMm, wxmMm: row.wxmMm, deltaMm: row.deltaMm, toleranceMm: row.toleranceMm, windowStart: row.windowStart, windowEnd: row.windowEnd, createdAt: row.createdAt })) });
    } catch (error) { return dataUnavailable(res, error); }
  });

  app.get("/api/settlement/evidence", async (_req, res) => {
    try {
      const rows = await db.select().from(settlementEvidence).orderBy(settlementEvidence.createdAt);
      return res.json({ rows: rows.map((row, i) => ({ id: i + 1, sourceHash: row.sourceHash, marketAddress: row.marketAddress, city: row.city, windowStart: row.windowStart, windowEnd: row.windowEnd, verdict: row.verdict, noaaMm: row.noaaMm, wxmMm: row.wxmMm, deltaMm: row.deltaMm, toleranceMm: row.toleranceMm, generatedAt: row.createdAt })) });
    } catch (error) { return res.status(500).json({ error: "EVIDENCE_ERROR", message: (error as Error).message }); }
  });

  app.get("/api/weather/:city/forecast", async (req, res) => {
    if (!limiter.allow(req.ip ?? "unknown")) return res.status(429).json({ error: "RATE_LIMITED", message: "Too many requests; try again shortly." });
    
    const city = citySchema.safeParse(req.params.city);
    const range = z.object({ start: z.string().date(), end: z.string().date() }).safeParse(req.query);
    if (!city.success || !range.success) return res.status(400).json({ error: "city, start, and end are required" });
    try {
      const records = await provider.forecastRainfall(city.data, range.data.start, range.data.end);
      const deduped = [...new Map(records.map((r) => [r.date, r])).values()];
      const cumulativeMm = cumulativeMillimeters(deduped);
      return res.json({ source: "NOAA-forecast", city: city.data, stationId: NOAA_STATIONS[city.data].stationId, start: range.data.start, end: range.data.end, records: deduped, cumulativeMm });
    } catch (error) { return dataUnavailable(res, error); }
  });

  app.post("/api/quotes", async (req, res) => {
    if (!limiter.allow(req.ip ?? "unknown")) return res.status(429).json({ error: "RATE_LIMITED", message: "Too many requests; try again shortly." });
    
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

  app.post("/api/ai/chat", async (req, res) => {
    if (!limiter.allow(req.ip ?? "unknown")) return res.status(429).json({ error: "RATE_LIMITED", message: "Too many requests; try again shortly." });
    const input = z.object({ message: z.string().min(1).max(2000), sessionId: z.string().max(128).optional() }).safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: "A message is required." });
    try {
      const result = await advisorChat(input.data.message);
      return res.json({ ...result, sessionId: input.data.sessionId ?? randomUUID() });
    } catch (error) {
      return res.status(500).json({ error: "AI_ADVISOR_ERROR", message: (error as Error).message });
    }
  });

  app.get("/api/portfolio/stats", async (req, res) => {
    const wallet = z.string().min(32).safeParse(req.query.wallet);
    if (!wallet.success) return res.status(400).json({ error: "a wallet address is required" });
    try {
      return res.json(await portfolioStats(wallet.data));
    } catch (error) { return dataUnavailable(res, error); }
  });

  app.get("/api/portfolio/:wallet", async (req, res) => {
    const wallet = req.params.wallet;
    try {
      const [protections, liquidities] = await Promise.all([
        db.select().from(protectionPositionsTable).where(eq(protectionPositionsTable.owner, wallet)),
        db.select().from(liquidityPositionsTable).where(eq(liquidityPositionsTable.provider, wallet)),
      ]);
      return res.json({
        wallet,
        source: "finalized-chain-indexer",
        indexed: true,
        protections: protections.map((p) => ({ market: p.marketAddress, address: p.address, protectedAmount: p.protectedAmount.toString(), premiumPaid: p.premiumPaid.toString() })),
        liquidity: liquidities.map((l) => ({ market: l.marketAddress, address: l.address, shares: l.shares.toString() })),
        message: "Positions reflect only finalized Solana state; nothing is simulated.",
      });
    } catch (error) {
      return res.json({ wallet, source: "finalized-chain-indexer", indexed: false, positions: [], message: "Indexer state is not available yet; SkyHedge never substitutes mock positions." });
    }
  });

  app.get("/api/staking/pools", async (_req, res) => {
    try {
      return res.json({ pools: await stakingPools() });
    } catch (error) { return dataUnavailable(res, error); }
  });

  app.get("/api/staking/user/:wallet", async (req, res) => {
    const wallet = z.string().min(32).safeParse(req.params.wallet);
    if (!wallet.success) return res.status(400).json({ error: "a wallet address is required" });
    try {
      return res.json(await stakingUser(wallet.data));
    } catch (error) { return dataUnavailable(res, error); }
  });

  app.get("/api/ai/insights", async (_req, res) => {
    try {
      return res.json(await aiInsights());
    } catch (error) { return dataUnavailable(res, error); }
  });

  app.get("/api/ai/accuracy", (_req, res) => {
    res.json(aiAccuracy());
  });

  app.post("/api/ai/parse-trade", async (req, res) => {
    if (!limiter.allow(req.ip ?? "unknown")) return res.status(429).json({ error: "RATE_LIMITED", message: "Too many requests; try again shortly." });
    const input = z.object({ message: z.string().min(1).max(2000) }).safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: "A trade description is required." });
    try {
      const result = await advisorChat(input.data.message);
      return res.json({
        source: result.source,
        confidence: result.confidence,
        parameters: result.advisory,
        recommendation: result.chainLink,
        response: result.response,
      });
    } catch (error) {
      return res.status(500).json({ error: "AI_PARSE_ERROR", message: (error as Error).message });
    }
  });

  app.get("/api/governance/proposals", (_req, res) => {
    res.json({ proposals: governance.list() });
  });

  app.post("/api/governance/proposals", (req, res) => {
    const input = z.object({ poolId: z.string().min(1).max(64), title: z.string().min(3).max(200), description: z.string().min(3).max(2000) }).safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: "poolId, title, and description are required" });
    res.status(201).json({ proposal: governance.create(input.data.poolId, input.data.title, input.data.description) });
  });

  app.post("/api/governance/vote", (req, res) => {
    const input = z.object({ proposalId: z.string().min(1).max(64), support: z.boolean() }).safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: "proposalId and support are required" });
    const updated = governance.vote(input.data);
    if (!updated) return res.status(404).json({ error: "UNKNOWN_PROPOSAL", message: "no active proposal with that id" });
    res.json({ proposal: updated });
  });

  app.post("/api/transactions/unsigned", async (req, res) => {
    const intent = z.object({ action: z.enum(["fund_pool", "withdraw_liquidity", "open_position", "claim_payout", "claim_premium_refund", "redeem_closed_liquidity"]), market: z.string().min(32), wallet: z.string().min(32), amount: z.string().regex(/^\d+$/).optional(), approved: z.literal(true) }).safeParse(req.body);
    if (!intent.success) return res.status(400).json({ error: "A valid market, wallet, and explicit approval are required." });
    try {
      const tx = await unsignedTx.build(intent.data.action as TxAction, intent.data.market, intent.data.wallet, intent.data.amount);
      return res.json({ ...tx, note: "Serialized as base64 VersionedTransaction with zero signatures; the wallet signs offline and the client broadcasts. No simulation." });
    } catch (error) {
      return res.status(500).json({ error: "TX_BUILD_ERROR", message: (error as Error).message });
    }
  });

  const indexerTimer = setInterval(() => { void indexer.reconcile().catch((error) => console.error("[indexer] reconcile failed:", error)); }, 30_000);
  const settlementStop = settlement.start(60_000);
  app.on("close", () => { clearInterval(indexerTimer); settlementStop(); });

  return createServer(app);
}

function dataUnavailable(res: Response, error: unknown) {
  if (error instanceof DataUnavailableError) return res.status(503).json({ error: error.code, message: error.message, settlementAction: "Do not synthesize a value; mark the market DATA_UNAVAILABLE after its on-chain deadline." });
  return res.status(500).json({ error: "WEATHER_SERVICE_ERROR", message: "Weather data could not be processed." });
}

class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly windowSeconds: number,
    private readonly maxHits: number,
  ) {}

  allow(key: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowSeconds * 1000;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= this.maxHits) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
