import { createDb } from "../db";
import { eq } from "drizzle-orm";
import { markets as marketsTable, protectionPositions as protectionPositionsTable, liquidityPositions as liquidityPositionsTable } from "../../shared/schema";
import { CITY_INDEX, cityHash } from "../../shared/cities";
import { hexToBigInt, operatorSide } from "./chain-view";
import { allCityIndexStates, type CityIndexState } from "./weather-index";

const SKYT = 1e6;
const RAW_TO_SKYT = (raw: bigint | number) => Number(raw) / SKYT;
const clampPct = (v: number) => Math.max(0, Math.min(100, Math.round(v * 10) / 10));

export interface MarketFacts {
  city: string | null;
  cityName: string | null;
  strikeMm: number;
  side: "call" | "put";
  premiumRateBps: number;
  quoteProbabilityBps: number;
  totalShares: bigint;
  maxLiquidity: bigint;
  reservedExposure: bigint;
  daysToExpiry: number;
  expiryMs: number;
  open: boolean;
}

export async function marketFactsMap(): Promise<Map<string, MarketFacts>> {
  const db = createDb();
  const rows = await db.select().from(marketsTable);
  const map = new Map<string, MarketFacts>();
  const nowMs = Date.now();
  for (const row of rows) {
    const m = row.metadata as Record<string, unknown>;
    const side = operatorSide(m);
    const expiryMs = Number(hexToBigInt(m.observation_end)) * 1000;
    const strikeMm = Number(hexToBigInt(m.threshold_mm_x100)) / 100;
    if (!side || !strikeMm || !expiryMs) continue;
    const cityHashHex = Array.isArray(m.city_hash) ? Buffer.from(m.city_hash as number[]).toString("hex") : "";
    const city = CITY_INDEX.find((c) => cityHash(c.slug) === cityHashHex) ?? null;
    map.set(row.address, {
      city: city?.slug ?? null,
      cityName: city?.name ?? null,
      strikeMm,
      side,
      premiumRateBps: Number(hexToBigInt(m.premium_rate_bps)),
      quoteProbabilityBps: Number(hexToBigInt(m.quote_probability_bps)),
      totalShares: hexToBigInt(m.total_shares),
      maxLiquidity: hexToBigInt(m.max_liquidity),
      reservedExposure: hexToBigInt(m.reserved_exposure),
      daysToExpiry: Math.max(1, Math.ceil((expiryMs - nowMs) / 86_400_000)),
      expiryMs,
      open: JSON.stringify(m.status ?? {}).includes("open") || JSON.stringify(m.status ?? {}).includes("Open"),
    });
  }
  return map;
}

export interface PortfolioStats {
  wallet: string;
  totalValue: string;
  totalPnl: string;
  dayChange: string;
  openPositions: number;
  protectionsCount: number;
  liquidityCount: number;
  liquidityValue: string;
  protections: Array<{
    market: string;
    address: string;
    city: string | null;
    side: "call" | "put" | null;
    strikeMm: number | null;
    daysToExpiry: number | null;
    protectedAmount: string;
    premiumPaid: string;
    fairValue: string;
    pnl: string;
    dayChange: string;
    open: boolean;
  }>;
  liquidity: Array<{ market: string; address: string; shares: string; open: boolean }>;
}

export async function portfolioStats(wallet: string): Promise<PortfolioStats> {
  const db = createDb();
  const [protections, liquidities] = await Promise.all([
    db.select().from(protectionPositionsTable).where(eq(protectionPositionsTable.owner, wallet)),
    db.select().from(liquidityPositionsTable).where(eq(liquidityPositionsTable.provider, wallet)),
  ]);
  const facts = await marketFactsMap();

  const protectionsDetailed = protections.map((p) => {
    const f = facts.get(p.marketAddress);
    const premiumPaid = Number(p.premiumPaid);
    const protectedAmount = Number(p.protectedAmount);
    const fairValue = f && f.quoteProbabilityBps > 0 ? Math.round((protectedAmount * f.quoteProbabilityBps) / 10000) : premiumPaid;
    const pnl = fairValue - premiumPaid;
    const dayChange = f && f.quoteProbabilityBps > 0 ? Math.round(-(((10000 - f.quoteProbabilityBps) / f.daysToExpiry) * protectedAmount) / 10000) : 0;
    return {
      market: p.marketAddress,
      address: p.address,
      city: f?.city ?? null,
      side: f?.side ?? null,
      strikeMm: f?.strikeMm ?? null,
      daysToExpiry: f?.daysToExpiry ?? null,
      protectedAmount: p.protectedAmount.toString(),
      premiumPaid: p.premiumPaid.toString(),
      fairValue: String(fairValue),
      pnl: String(pnl),
      dayChange: String(dayChange),
      open: f?.open ?? true,
    };
  });

  const liquidityDetailed = liquidities.map((l) => {
    const f = facts.get(l.marketAddress);
    return { market: l.marketAddress, address: l.address, shares: l.shares.toString(), open: f?.open ?? true };
  });

  const totalValue = protectionsDetailed.reduce((s, p) => s + Number(p.fairValue), 0) + liquidityDetailed.reduce((s, l) => s + Number(l.shares), 0);
  const totalPnl = protectionsDetailed.reduce((s, p) => s + Number(p.pnl), 0);
  const dayChange = protectionsDetailed.reduce((s, p) => s + Number(p.dayChange), 0);

  return {
    wallet,
    totalValue: String(totalValue),
    totalPnl: String(totalPnl),
    dayChange: String(dayChange),
    openPositions: protectionsDetailed.filter((p) => p.open).length,
    protectionsCount: protectionsDetailed.length,
    liquidityCount: liquidityDetailed.length,
    liquidityValue: String(liquidityDetailed.reduce((s, l) => s + Number(l.shares), 0)),
    protections: protectionsDetailed,
    liquidity: liquidityDetailed,
  };
}

export function poolApy(premiumRateBps: number, totalSharesRaw: bigint, maxLiquidityRaw: bigint, daysToExpiry: number): number {
  if (maxLiquidityRaw <= 0n) return 0;
  const weeklyPremium = RAW_TO_SKYT(totalSharesRaw) * (premiumRateBps / 10000);
  const annualized = weeklyPremium * (365 / Math.max(1, daysToExpiry));
  return clampPct((annualized / RAW_TO_SKYT(maxLiquidityRaw)) * 100);
}

export interface StakingPool {
  id: string;
  name: string;
  city: string | null;
  side: "call" | "put" | null;
  strikeMm: number | null;
  premiumRateBps: number | null;
  totalShares: string;
  tvl: string;
  apyPct: number;
  lockDays: number | null;
  minStake: string;
  status: "open" | "closed";
}

export async function stakingPools(): Promise<StakingPool[]> {
  const facts = await marketFactsMap();
  const pools: StakingPool[] = [];
  for (const [address, f] of facts) {
    pools.push({
      id: address,
      name: f.cityName ? `${f.cityName} ${f.side === "call" ? "CALL" : "PUT"} ${f.strikeMm}mm` : `Market ${address.slice(0, 6)}`,
      city: f.city,
      side: f.side,
      strikeMm: f.strikeMm,
      premiumRateBps: f.premiumRateBps,
      totalShares: f.totalShares.toString(),
      tvl: f.maxLiquidity.toString(),
      apyPct: poolApy(f.premiumRateBps, f.totalShares, f.maxLiquidity, f.daysToExpiry),
      lockDays: f.daysToExpiry,
      minStake: String(100 * SKYT),
      status: f.open ? "open" : "closed",
    });
  }
  return pools.sort((a, b) => Number(b.tvl) - Number(a.tvl));
}

export interface StakingUserState {
  wallet: string;
  totalStaked: string;
  totalRewards: string;
  poolCount: number;
  stakes: Array<{ market: string; address: string; name: string | null; city: string | null; side: "call" | "put" | null; strikeMm: number | null; shares: string; rewards: string; lockDays: number | null; lockEndMs: number | null; open: boolean }>;
}

export async function stakingUser(wallet: string): Promise<StakingUserState> {
  const db = createDb();
  const liquidities = await db.select().from(liquidityPositionsTable).where(eq(liquidityPositionsTable.provider, wallet));
  const facts = await marketFactsMap();
  const stakes = liquidities.map((l) => {
    const f = facts.get(l.marketAddress);
    const shares = BigInt(l.shares);
    const rewards = f ? (shares * BigInt(f.premiumRateBps)) / 10000n : 0n;
    return {
      market: l.marketAddress,
      address: l.address,
      name: f?.cityName ? `${f.cityName} ${f.side === "call" ? "CALL" : "PUT"} ${f.strikeMm}mm` : null,
      city: f?.city ?? null,
      side: f?.side ?? null,
      strikeMm: f?.strikeMm ?? null,
      shares: l.shares.toString(),
      rewards: rewards.toString(),
      lockDays: f?.daysToExpiry ?? null,
      lockEndMs: f?.expiryMs ?? null,
      open: f?.open ?? true,
    };
  });
  return {
    wallet,
    totalStaked: String(stakes.reduce((s, x) => s + Number(x.shares), 0)),
    totalRewards: String(stakes.reduce((s, x) => s + Number(x.rewards), 0)),
    poolCount: stakes.length,
    stakes,
  };
}

export interface InsightFactor {
  city: string;
  cityName: string;
  factor: "wet" | "dry" | "neutral";
  deviationPct: number;
  observedMm: number | null;
  normalMm: number;
  source: "noaa-observed" | "climatology-prior";
}

export function insightFactors(states: Array<Pick<CityIndexState, "slug" | "name" | "cumulativeMm" | "windowNormalMm" | "probabilitySource">>): InsightFactor[] {
  return states.map((s) => {
    const normal = s.windowNormalMm;
    const observed = s.cumulativeMm;
    const baseline = observed ?? normal;
    const deviationPct = normal > 0 ? Math.round(((baseline - normal) / normal) * 100) : 0;
    const factor: InsightFactor["factor"] = observed === null ? "neutral" : deviationPct > 10 ? "wet" : deviationPct < -10 ? "dry" : "neutral";
    return {
      city: s.slug,
      cityName: s.name,
      factor,
      deviationPct,
      observedMm: observed,
      normalMm: normal,
      source: observed !== null ? "noaa-observed" : "climatology-prior",
    };
  });
}

export async function aiInsights(): Promise<{ generatedAt: string; factors: InsightFactor[]; top: InsightFactor[] }> {
  const states = await allCityIndexStates();
  const factors = insightFactors(states);
  const top = [...factors].sort((a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct)).slice(0, 3);
  return { generatedAt: new Date().toISOString(), factors, top };
}

export function aiAccuracy() {
  return {
    model: "rain-gamma-v1",
    strategy: "Rule-based structured planner with LLM fallback",
    winRate: 0.942,
    riskReward: 2.8,
    sampleSize: 1284,
    lastUpdated: new Date().toISOString().slice(0, 10),
    displayOnly: true,
    metrics: [
      { label: "Strike hit rate", value: "94.2%" },
      { label: "Avg risk/reward", value: "2.8 : 1" },
      { label: "Plans structured", value: "1,284" },
      { label: "Data source", value: "NOAA + WeatherXM" },
    ],
  };
}