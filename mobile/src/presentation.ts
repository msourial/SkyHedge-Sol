import type { AgriculturalMarket, CityIndex, DevnetStatus } from "./api";
import type { HazardId } from "./hazards.ts";
import { isOnchainMarketOpen } from "./protection.ts";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Display-only amount. It is never a SKYT quote or a token exchange rate. */
export function formatUsdPreview(input: string): string | null {
  const value = input.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(value) || Number(value) <= 0) return null;
  return `$${value}`;
}

export function resolveSelectedNoaaCity(slug: string, cities: CityIndex[]): CityIndex | null {
  return cities.find((city) => city.slug === slug) ?? null;
}

export function researchLocationLabel(slug: string, market: AgriculturalMarket | undefined): string | null {
  if (slug === "toronto") return "Toronto, Ontario, Canada";
  if (slug === "saskatoon") return "Saskatoon, Saskatchewan, Canada";
  return market ? `${market.locality}, ${market.administrativeArea}, ${market.country}` : null;
}

export function recentNoaaHistoryForArea(slug: string, city: CityIndex | null): CityIndex["weeklyHistoryMm"] {
  return city?.slug === slug ? city.weeklyHistoryMm?.slice(-6) ?? null : null;
}

export function latestCompletedNoaaWeek(history: CityIndex["weeklyHistoryMm"]): { week: string; mm: number } | null {
  return history?.slice().reverse().find((week): week is { week: string; mm: number } =>
    week.mm !== null && Number.isFinite(week.mm) && week.mm >= 0) ?? null;
}

export function rainfallBarPercent(millimeters: number | null, maximum: number): number | null {
  if (millimeters === null || !Number.isFinite(millimeters) || millimeters < 0 || !Number.isFinite(maximum) || maximum <= 0) return null;
  return Math.min(100, (millimeters / maximum) * 100);
}

export function riskChoiceForArea(slug: string, hazard: HazardId): { detail: string; canReview: boolean } {
  if (hazard === "wind-gust") return { detail: "Wind-gust evidence and contract rules are still being researched. No quote is available.", canReview: false };
  if (hazard === "snowfall") return { detail: "Snowfall evidence and contract rules are still being researched. No quote is available.", canReview: false };
  return slug === "des-moines"
    ? { detail: "Rainfall pilot · review its live Devnet readiness before requesting any quote.", canReview: true }
    : { detail: "Rainfall evidence is still being researched for this place. Review why protection is unavailable.", canReview: true };
}

export function searchAgriculturalMarkets(markets: AgriculturalMarket[], query: string) {
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
  if (!terms.length) return markets;

  return markets.filter((market) => {
    const searchable = normalize([
      market.name,
      market.locality,
      market.administrativeArea,
      market.country,
      market.region,
      market.agriculturalContext,
      ...market.crops,
    ].join(" "));
    return terms.every((term) => searchable.includes(term));
  });
}

export function formatOnchainMarketStatus(value: string | null): string {
  if (!value) return "Unavailable";
  let status = value;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === "object" && parsed !== null) status = Object.keys(parsed)[0] ?? value;
  } catch {
    // Plain-text status values are also accepted by the public API.
  }
  return status.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function isMarketReadyForCity(citySlug: string, status: DevnetStatus | null) {
  if (citySlug !== "des-moines" || !status) return false;
  const market = status.desMoinesMarket;
  return status.network.toLowerCase() === "devnet"
    && status.program.executable
    && status.program.status === "ready"
    && status.idl.status === "ready"
    && status.protocol.initialized
    && market.status === "ready"
    && !!market.address
    && !!market.vault
    && isOnchainMarketOpen(market.onchainStatus)
    && market.evidenceStatus === "validated"
    && !!market.vaultBalance
    && /^\d+$/.test(market.vaultBalance)
    && BigInt(market.vaultBalance) > 0n
    && status.noaaEvidence.status === "ready"
    && status.noaaEvidence.settlementSource === "NOAA"
    && !!status.noaaEvidence.package?.stationId;
}

export type MarketListChipTone = "live" | "soon" | "closed" | "other";

/** Green only while sales are live. Closed sales are neutral. Soon and other non-live labels are amber. */
export function marketListChipTone(status: "live" | "ready" | "soon" | "concept", label?: string): MarketListChipTone {
  if (label === "Open" || label === "Weekly · Monthly open" || label === "Weekly open" || label === "Monthly open") return "live";
  if (label === "Soon" || label === "Next window opening shortly") return "soon";
  if (label === "Sales closed") return "closed";
  if (status === "live" && (label === undefined || label === "Live")) return "live";
  if (status === "soon" || status === "live") return "soon";
  return "other";
}

/** City rows stay readable: a selling window is Open, everything else is Soon. */
export function compactRowChip(open: boolean): { label: "Open" | "Soon"; tone: "live" | "soon" } {
  return open ? { label: "Open", tone: "live" } : { label: "Soon", tone: "soon" };
}

/** Compact status for catalog rows; detailed evidence remains in the selected place view. */
export function catalogAvailability(market: AgriculturalMarket, status: DevnetStatus | null): { label: string; tone: "ready" | "pending" | "neutral" } {
  if (market.slug !== "des-moines") return { label: "Researching", tone: "pending" };
  return isMarketReadyForCity(market.slug, status)
    ? { label: "Active pilot", tone: "ready" }
    : { label: "Unavailable", tone: "neutral" };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-09-07" -> "Sep 7"; falls back to the raw value when not an ISO date. */
export function formatWeekLabel(week: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(week);
  if (!match) return week;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${Number(match[3])}` : week;
}

/** Bar value label with unit; unavailable weeks read "n/a" instead of a bare dash. */
export function formatRainfallBarValue(mm: number | null | undefined): string {
  return mm == null || !Number.isFinite(mm) ? "n/a" : `${mm.toFixed(mm < 10 ? 1 : 0)}`;
}
