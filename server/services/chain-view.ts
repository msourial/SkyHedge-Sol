import { createDb } from "../db";
import { markets as marketsTable } from "../../shared/schema";
import { cityBySlug, cityHash, windowNormalMm, type CityIndex } from "../../shared/cities";
import { chainWindowsFrom, strikeSetFor, type ChainSide, type ChainWindow } from "./chain-pricing";

interface MarketRowLike {
  address: string;
  metadata: Record<string, unknown>;
}

export interface ChainCell {
  side: ChainSide;
  strikeMm: number;
  expiry: string;
  marketAddress: string | null;
  status: string | null;
  premiumRateBps: number | null;
  quoteProbabilityBps: number | null;
  totalShares: string | null;
  daysToExpiry: number | null;
  bidBps: number | null;
  askBps: number | null;
  thetaBps: number | null;
}

export interface ChainGrid {
  city: string;
  windows: Array<{ start: string; end: string; isLive: boolean; normalMm: number }>;
  strikes: number[];
  cells: ChainCell[];
  probabilitySource: "noaa-10yr" | "climatology-prior";
}

export function hexToBigInt(v: unknown): bigint {
  if (typeof v === "string" && /^[0-9a-f]+$/i.test(v)) return BigInt(`0x${v}`);
  return BigInt(String(v ?? 0));
}

export function operatorSide(metadata: Record<string, unknown>): ChainSide | null {
  const op = metadata.operator;
  if (op && typeof op === "object") {
    const keys = Object.keys(op as object);
    if (keys.some((k) => k.toLowerCase().includes("greater"))) return "call";
    if (keys.some((k) => k.toLowerCase().includes("less"))) return "put";
  }
  return null;
}

function isOpen(status: unknown): boolean {
  const s = JSON.stringify(status ?? {});
  return s.includes("open") || s.includes("Open");
}

/**
 * Builds the options chain grid for a city from indexed on-chain markets.
 * Cells are matched by (observation_end, threshold_mm_x100, operator side).
 * Missing cells are honest "no market yet" entries, never synthesized.
 */
export async function buildChainGrid(slug: string): Promise<ChainGrid | null> {
  const city = cityBySlug(slug);
  if (!city) return null;

  const db = createDb();
  const rows = (await db.select().from(marketsTable)) as MarketRowLike[];
  const cityRows = rows.filter((row) => {
    const hash = Array.isArray(row.metadata.city_hash) ? Buffer.from(row.metadata.city_hash as number[]).toString("hex") : "";
    return hash.length > 0 && cityHash(city.slug) === hash;
  });

  const now = new Date();
  const windows: ChainWindow[] = chainWindowsFrom(new Date(now.getTime() + 7 * 86_400_000), 4);
  const normal = windowNormalMm(city, windows[0].start.getTime(), windows[0].end.getTime());
  const strikes = strikeSetFor(normal);

  const byCell = new Map<string, ChainCell>();
  const nowMs = Date.now();
  for (const row of cityRows) {
    const m = row.metadata;
    const side = operatorSide(m);
    const expiry = Number(hexToBigInt(m.observation_end)) * 1000;
    const strikeMm = Number(hexToBigInt(m.threshold_mm_x100)) / 100;
    if (!side || !strikeMm || !expiry) continue;
    const key = `${expiry}|${strikeMm}|${side}`;
    const premiumRateBps = Number(hexToBigInt(m.premium_rate_bps));
    const quoteProbabilityBps = Number(hexToBigInt(m.quote_probability_bps));
    const daysToExpiry = Math.max(1, Math.ceil((expiry - nowMs) / 86_400_000));
    byCell.set(key, {
      side,
      strikeMm,
      expiry: new Date(expiry).toISOString().slice(0, 10),
      marketAddress: row.address,
      status: isOpen(m.status) ? "open" : "closed",
      premiumRateBps,
      quoteProbabilityBps,
      totalShares: hexToBigInt(m.total_shares).toString(),
      daysToExpiry,
      bidBps: premiumRateBps > 0 ? Math.max(0, premiumRateBps - 100) : null,
      askBps: premiumRateBps > 0 ? premiumRateBps + 100 : null,
      thetaBps: quoteProbabilityBps > 0 && quoteProbabilityBps < 10000 ? Math.round(((10000 - quoteProbabilityBps) / daysToExpiry) * 10) / 10 : null,
    });
  }

  const cells: ChainCell[] = [];
  for (const w of windows) {
    const expiryMs = w.end.getTime();
    for (const strike of strikes) {
      for (const side of ["call", "put"] as ChainSide[]) {
        cells.push(
          byCell.get(`${expiryMs}|${strike}|${side}`) ?? {
            side,
            strikeMm: strike,
            expiry: new Date(expiryMs).toISOString().slice(0, 10),
            marketAddress: null,
            status: null,
            premiumRateBps: null,
            quoteProbabilityBps: null,
            totalShares: null,
            daysToExpiry: Math.max(1, Math.ceil((expiryMs - nowMs) / 86_400_000)),
            bidBps: null,
            askBps: null,
            thetaBps: null,
          },
        );
      }
    }
  }

  return {
    city: city.slug,
    windows: windows.map((w, i) => ({
      start: w.start.toISOString().slice(0, 10),
      end: w.end.toISOString().slice(0, 10),
      isLive: i === 0,
      normalMm: windowNormalMm(city, w.start.getTime(), w.end.getTime()),
    })),
    strikes,
    cells,
    probabilitySource: process.env.NOAA_TOKEN ? "noaa-10yr" : "climatology-prior",
  };
}