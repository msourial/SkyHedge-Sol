/**
 * SkyHedge market catalogue for the Seeker app.
 * - Des Moines (DSM) is the only Live market and the only one with pricing or on-chain actions.
 * - Toronto Pearson (YYZ) is "Opens soon".
 * - Everything else is a non-tradable Concept pin: real airport coordinates + the national met service
 *   that would supply the data. No prices, triggers or rainfall figures exist for concepts and none are shown.
 * - "Ready to open" (Chicago O'Hare, New York Central Park, Miami): the NOAA GHCND station is already in the
 *   settlement pipeline (shared/cities.ts, methodology-v1.json) but no Devnet market account exists yet, so
 *   nothing is priced or tradable until the admin signs create_market and the API serves the market.
 * Rows live in markets-data.ts, generated (with map positions) by tools/gen_geo.py.
 */
import { MARKET_DATA } from "./markets-data.ts";
export type MarketStatus = "live" | "ready" | "soon" | "concept";
export type MarketGroup = "North America" | "Latin America" | "Africa" | "Middle East" | "South Asia" | "Southeast Asia" | "East Asia" | "Europe" | "Oceania";
export type CatalogMarket = {
  code: string; name: string; region: string; country: string; group: MarketGroup;
  lat: number; lon: number; source: string; status: MarketStatus;
  /** NOAA GHCND station id, only where the settlement pipeline already knows the station. */
  station?: string;
  /** Position in REGION_VIEW (Lambert conformal conic); only meaningful for North America. */
  regionXY: [number, number];
  /** Position in GLOBAL_VIEW (Equal Earth). */
  globalXY: [number, number];
};

export const MARKETS: readonly CatalogMarket[] = MARKET_DATA;

export const GROUP_ORDER: readonly MarketGroup[] = ["North America", "Latin America", "Europe", "Africa", "Middle East", "South Asia", "Southeast Asia", "East Asia", "Oceania"];

export function marketByCode(code: string): CatalogMarket | undefined {
  return MARKETS.find((m) => m.code === code);
}

export function isTradable(m: CatalogMarket): boolean {
  return m.status === "live";
}

function norm(v: string): string {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export const statusTone = (s: MarketStatus): "mint" | "rain" | "amber" => (s === "live" ? "mint" : s === "soon" ? "amber" : "rain");

/** Case/accent-insensitive search across name, code, region and source. Live first, then soon, then concept. */
export function searchMarkets(query: string, scope: "region" | "global" | "all" = "all", group: MarketGroup | null = null): CatalogMarket[] {
  const q = norm(query);
  const rank = { live: 0, ready: 1, soon: 2, concept: 3 } as const;
  return MARKETS
    .filter((m) => scope === "all" || (scope === "region" ? m.group === "North America" : true))
    .filter((m) => !group || m.group === group)
    .filter((m) => !q || [m.name, m.code, m.region, m.source, m.country].some((f) => norm(f).includes(q)))
    .sort((a, b) => rank[a.status] - rank[b.status]);
}

export function groupCounts(): Array<{ group: MarketGroup; count: number; sources: string[] }> {
  return GROUP_ORDER.map((group) => {
    const ms = MARKETS.filter((m) => m.group === group);
    return { group, count: ms.length, sources: [...new Set(ms.map((m) => m.source))] };
  });
}

/** Splits a name around the first match so search hits can be bolded. */
export function highlightParts(name: string, query: string): [string, string, string] {
  const q = norm(query);
  const i = q ? norm(name).indexOf(q) : -1;
  if (i < 0) return [name, "", ""];
  return [name.slice(0, i), name.slice(i, i + q.length), name.slice(i + q.length)];
}
