/**
 * Rolling rain expiries for each live city.
 * Weekly: Monday 00:00 UTC through the next Monday. Monthly: calendar month UTC.
 * Sales close when the window starts. Depth is the next 2 open rungs per tenor.
 * Strike and premium helpers never invent a rainfall total.
 */

export const DAY_SECONDS = 86_400;
export const LADDER_DEPTH = 2;
export const ANALOGUE_YEARS = 10;
/** 1-based rank in the sorted analogue totals (8th of 10 is the 80th percentile). */
export const STRIKE_RANK = 8;
/** New York first, then Dallas, then Des Moines. Toronto is not live. */
export const LIVE_CITY_SLUGS = ["new-york", "dallas", "des-moines"] as const;
export type LiveCitySlug = (typeof LIVE_CITY_SLUGS)[number];
export type Tenor = "weekly" | "monthly";

export interface LadderWindow {
  tenor: Tenor;
  /** Equal to observationStart. Sales are open only before this instant. */
  salesCloseAt: number;
  observationStart: number;
  observationEnd: number;
}

export interface LadderMarketRef {
  city?: LiveCitySlug;
  marketId?: string;
  address?: string;
  state: "draft" | "open" | "cancelled" | "other";
  salesCloseAt: number | null;
  observationStart: number | null;
  observationEnd: number | null;
  vaultBalanceBase: string | null;
}

export type LadderStep =
  | { action: "create-fund-open"; window: LadderWindow; city?: LiveCitySlug }
  | { action: "fund-open" | "open"; window: LadderWindow; marketId: string; address: string; city?: LiveCitySlug };

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function openWeeklyWindows(nowSeconds: number, count = LADDER_DEPTH): LadderWindow[] {
  const first = nextMondayStart(nowSeconds);
  return Array.from({ length: count }, (_, index) => {
    const observationStart = first + index * 7 * DAY_SECONDS;
    return weeklyWindow(observationStart);
  });
}

export function openMonthlyWindows(nowSeconds: number, count = LADDER_DEPTH): LadderWindow[] {
  let start = nextMonthStart(nowSeconds);
  return Array.from({ length: count }, () => {
    const window = monthlyWindow(start);
    start = window.observationEnd;
    return window;
  });
}

export function openLadder(nowSeconds: number, count = LADDER_DEPTH): LadderWindow[] {
  return [...openWeeklyWindows(nowSeconds, count), ...openMonthlyWindows(nowSeconds, count)];
}

export function tenorOf(observationStart: number, observationEnd: number): Tenor | null {
  if (!Number.isSafeInteger(observationStart) || !Number.isSafeInteger(observationEnd) || observationEnd <= observationStart) return null;
  const start = new Date(observationStart * 1_000);
  if (start.getUTCHours() !== 0 || start.getUTCMinutes() !== 0 || start.getUTCSeconds() !== 0) return null;
  if (observationEnd - observationStart === 7 * DAY_SECONDS && start.getUTCDay() === 1) return "weekly";
  if (start.getUTCDate() !== 1) return null;
  const monthEnd = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1) / 1_000;
  return observationEnd === monthEnd ? "monthly" : null;
}

export function expiryLabel(window: Pick<LadderWindow, "tenor" | "observationStart">): string {
  const date = new Date(window.observationStart * 1_000);
  if (window.tenor === "monthly") return FULL_MONTHS[date.getUTCMonth()] ?? "Month";
  return `Week of ${SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

export function marketsOpenLabel(tenors: readonly Tenor[]): string {
  const weekly = tenors.includes("weekly");
  const monthly = tenors.includes("monthly");
  if (weekly && monthly) return "Weekly · Monthly open";
  if (weekly) return "Weekly open";
  if (monthly) return "Monthly open";
  return "Next window opening shortly";
}

export const NEXT_WINDOW_COPY = "Next window opening shortly";
export const STRIKE_BASIS = "NOAA GHCND · 8th of 10 analogue years";

/**
 * Whole-millimetre strike from 10 NOAA analogue cumulative totals.
 * Returns null when the history is incomplete or the 8th value is not a positive millimetre.
 */
export function strikeFromAnalogueTotals(totalsMm: readonly number[]): number | null {
  if (totalsMm.length !== ANALOGUE_YEARS) return null;
  if (totalsMm.some((value) => !Number.isFinite(value) || value < 0)) return null;
  const sorted = [...totalsMm].sort((left, right) => left - right);
  const strike = Math.ceil(sorted[STRIKE_RANK - 1] ?? Number.NaN);
  if (!Number.isSafeInteger(strike) || strike <= 0) return null;
  return strike;
}

/** Same premium curve as quote-engine and the on-chain program. Forecast null means history only. */
export function priceFromSignals(historicProbabilityBps: number, forecastProbabilityBps: number | null): {
  probabilityBps: number;
  premiumRateBps: number;
  forecastWeight: number;
} {
  const probabilityBps = forecastProbabilityBps == null
    ? clamp(historicProbabilityBps, 100, 9_000)
    : clamp(Math.round(historicProbabilityBps * 0.7 + forecastProbabilityBps * 0.3), 100, 9_000);
  const premiumRateBps = Math.ceil((probabilityBps * 11_500) / 10_000) + 100;
  return { probabilityBps, premiumRateBps, forecastWeight: forecastProbabilityBps == null ? 0 : 0.3 };
}

export function historicHitBps(totalsMm: readonly number[], thresholdMm: number): number | null {
  if (totalsMm.length !== ANALOGUE_YEARS || !Number.isFinite(thresholdMm) || thresholdMm <= 0) return null;
  const hits = totalsMm.filter((total) => total >= thresholdMm).length;
  return Math.round((hits / ANALOGUE_YEARS) * 10_000);
}

/**
 * Rungs still missing, plus draft resumes. A non-cancelled market with the same
 * observation bounds is never created again.
 */
/**
 * One ladder per live city. A Des Moines window does not count as a Dallas or New York window.
 */
export function planCityLadders(
  markets: readonly LadderMarketRef[],
  nowSeconds: number,
  cities: readonly LiveCitySlug[] = LIVE_CITY_SLUGS,
  count = LADDER_DEPTH,
): LadderStep[] {
  return cities.flatMap((city) => planLadderRoll(
    markets.filter((market) => market.city === city),
    nowSeconds,
    count,
  ).map((step) => ({ ...step, city })));
}

export function planLadderRoll(markets: readonly LadderMarketRef[], nowSeconds: number, count = LADDER_DEPTH): LadderStep[] {
  const steps: LadderStep[] = [];
  for (const window of openLadder(nowSeconds, count)) {
    const matches = markets.filter((market) => market.state !== "cancelled"
      && market.observationStart === window.observationStart
      && market.observationEnd === window.observationEnd);
    if (matches.length === 0) {
      steps.push({ action: "create-fund-open", window });
      continue;
    }
    const draft = matches.find((market) => market.state === "draft" && market.marketId && market.address);
    const open = matches.some((market) => market.state === "open" || market.state === "other");
    if (!draft || open) continue;
    const funded = !!draft.vaultBalanceBase && /^\d+$/.test(draft.vaultBalanceBase) && BigInt(draft.vaultBalanceBase) > 0n;
    steps.push({
      action: funded ? "open" : "fund-open",
      window,
      marketId: draft.marketId!,
      address: draft.address!,
    });
  }
  return steps;
}

function weeklyWindow(observationStart: number): LadderWindow {
  return {
    tenor: "weekly",
    salesCloseAt: observationStart,
    observationStart,
    observationEnd: observationStart + 7 * DAY_SECONDS,
  };
}

function monthlyWindow(observationStart: number): LadderWindow {
  const date = new Date(observationStart * 1_000);
  return {
    tenor: "monthly",
    salesCloseAt: observationStart,
    observationStart,
    observationEnd: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / 1_000,
  };
}

function nextMondayStart(nowSeconds: number): number {
  const midnight = Math.floor(nowSeconds / DAY_SECONDS) * DAY_SECONDS;
  const dow = new Date(midnight * 1_000).getUTCDay();
  const monday = midnight - ((dow + 6) % 7) * DAY_SECONDS;
  return nowSeconds < monday ? monday : monday + 7 * DAY_SECONDS;
}

function nextMonthStart(nowSeconds: number): number {
  const date = new Date(nowSeconds * 1_000);
  const thisMonth = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1_000;
  if (nowSeconds < thisMonth) return thisMonth;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / 1_000;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
