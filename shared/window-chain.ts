/**
 * Options-chain labels and trigger rows for an open rain expiry.
 * Millimetres, chances, and premiums come only from NOAA analogue totals
 * or from terms already pinned on a Devnet market. Nothing here invents a rainfall total.
 */
import {
  ANALOGUE_YEARS,
  historicHitBps,
  priceFromSignals,
  tenorOf,
  type LiveCitySlug,
  type Tenor,
} from "./window-ladder.ts";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_SECONDS = 86_400;
/** Ranks 5 through 10 of the 10 analogue years: up to six whole-millimetre triggers. */
const LADDER_RANKS = [5, 6, 7, 8, 9, 10] as const;
const HUNDRED_SKYT_BASE = 100_000_000n;

export interface WindowEvidencePackage {
  validated: true;
  city: LiveCitySlug;
  stationId: string;
  tenor: Tenor;
  observationStart: number;
  observationEnd: number;
  analogueTotalsMm: number[];
  strikeMm: number;
  forecastCumulativeMm: number | null;
}

export interface TriggerRow {
  thresholdMm: number;
  probabilityBps: number;
  premiumRateBps: number;
  onChain: boolean;
  popular: boolean;
}

export function sortByExpiry<T extends { observationEnd: number; observationStart?: number }>(windows: readonly T[]): T[] {
  return [...windows].sort((left, right) => left.observationEnd - right.observationEnd || (left.observationStart ?? 0) - (right.observationStart ?? 0));
}

/**
 * One date convention everywhere (header, chip, sheet, Wallet): the UTC dates stored on the market
 * account, start to observation_end, marked "(UTC)". Example: "Oct 26 – Nov 2 (UTC)" for the window
 * that ends Nov 2 00:00 UTC. A local-time date would read Nov 1 in the Americas.
 */
export function committedWindowLabel(window: { observationStart: number; observationEnd: number }): string | null {
  const from = utcDayLabel(window.observationStart);
  const to = utcDayLabel(window.observationEnd);
  return from && to ? `${from} – ${to} (UTC)` : null;
}

/** "Oct 26 (UTC)": the observation start. */
export function windowStartLabel(window: { observationStart: number }): string | null {
  const from = utcDayLabel(window.observationStart);
  return from ? `${from} (UTC)` : null;
}

/** "Nov 2 (UTC)": the observation end, as the sheet and Wallet show it. */
export function windowEndLabel(window: { observationEnd: number }): string | null {
  const to = utcDayLabel(window.observationEnd);
  return to ? `${to} (UTC)` : null;
}

function utcDayLabel(seconds: number): string | null {
  if (!Number.isSafeInteger(seconds) || seconds <= 0) return null;
  const date = new Date(seconds * 1_000);
  const month = SHORT_MONTHS[date.getUTCMonth()];
  return month ? `${month} ${date.getUTCDate()}` : null;
}

/** UTC observation-end day, marked W or M. Example: "Nov 2 · W" for Oct 26 – Nov 2 (UTC). */
export function expiryChipLabel(window: { observationStart: number; observationEnd: number }): string | null {
  const tenor = tenorOf(window.observationStart, window.observationEnd);
  if (!tenor) return null;
  const end = new Date(window.observationEnd * 1_000);
  const month = SHORT_MONTHS[end.getUTCMonth()];
  if (!month) return null;
  return `${month} ${end.getUTCDate()} · ${tenor === "weekly" ? "W" : "M"}`;
}

export function daysToExpiry(observationEnd: number, nowSeconds: number): number | null {
  if (!Number.isSafeInteger(observationEnd) || !Number.isSafeInteger(nowSeconds) || observationEnd <= nowSeconds) return observationEnd > nowSeconds ? 0 : null;
  return Math.ceil((observationEnd - nowSeconds) / DAY_SECONDS);
}

export function daysToExpiryLabel(days: number | null): string {
  if (days == null) return "Expired";
  if (days === 0) return "Ends today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function settlementLine(stationSource: string): string {
  return `${stationSource} · settles after expiry from NOAA final data`;
}

/** "Weekly · ends Nov 2 · 13 days". Date and days both follow the UTC observation end. */
export function expiryChipCopy(window: { observationStart: number; observationEnd: number }, nowSeconds: number): string | null {
  const dated = expiryChipLabel(window);
  if (!dated) return null;
  const [date, mark] = dated.split(" · ");
  const name = mark === "M" ? "Monthly" : "Weekly";
  return `${name} · ends ${date} · ${daysToExpiryLabel(daysToExpiry(window.observationEnd, nowSeconds))}`;
}

export function measuredAtLine(station: string, expiry: string): string {
  const place = station.replace(/^NOAA\s+/i, "");
  const end = /\(UTC\)$/.test(expiry) || !/\d/.test(expiry) ? expiry : `${expiry} (UTC)`;
  return `Measured at NOAA ${place}. Pays out from NOAA's final numbers after ${end}.`;
}

export function pricedTriggers<T extends { onChain: boolean }>(rows: readonly T[]): { priced: T[]; soonCount: number } {
  const priced = rows.filter((row) => row.onChain);
  return { priced, soonCount: rows.length - priced.length };
}

export function matchingWindowPackage(
  packages: readonly WindowEvidencePackage[] | null | undefined,
  city: string,
  observationStart: number | null | undefined,
  observationEnd: number | null | undefined,
): WindowEvidencePackage | null {
  if (!packages || !observationStart || !observationEnd) return null;
  return packages.find((pkg) => pkg.validated
    && pkg.city === city
    && pkg.observationStart === observationStart
    && pkg.observationEnd === observationEnd
    && pkg.analogueTotalsMm.length === ANALOGUE_YEARS
    && Number.isSafeInteger(pkg.strikeMm)
    && pkg.strikeMm >= 0) ?? null;
}

/**
 * Whole-millimetre triggers from analogue ranks 5–10.
 * Includes the on-chain threshold when it is a positive whole millimetre.
 * Returns at most six rows. Returns [] when the analogue set is incomplete.
 */
export function triggerLadderMm(totalsMm: readonly number[], onChainMm: number | null): number[] {
  if (totalsMm.length !== ANALOGUE_YEARS) return [];
  if (totalsMm.some((value) => !Number.isFinite(value) || value < 0)) return [];
  const sorted = [...totalsMm].sort((left, right) => left - right);
  const values: number[] = [];
  for (const rank of LADDER_RANKS) {
    const strike = Math.ceil(sorted[rank - 1] ?? Number.NaN);
    if (Number.isSafeInteger(strike) && strike > 0 && !values.includes(strike)) values.push(strike);
  }
  if (onChainMm != null && Number.isSafeInteger(onChainMm) && onChainMm > 0 && !values.includes(onChainMm)) values.push(onChainMm);
  values.sort((left, right) => left - right);
  if (values.length <= 6) return values;
  const anchor = onChainMm != null && values.includes(onChainMm) ? onChainMm : values[Math.floor((values.length - 1) / 2)]!;
  const anchorIndex = values.indexOf(anchor);
  let start = Math.max(0, anchorIndex - 2);
  if (start + 6 > values.length) start = values.length - 6;
  return values.slice(start, start + 6);
}

export function middleTriggerIndex(count: number): number {
  if (count <= 0) return 0;
  return Math.floor((count - 1) / 2);
}

/** Ceil premium in SKYT base units. Same rounding as the quote engine. */
export function premiumBaseFor(amountBase: bigint, premiumRateBps: number): bigint | null {
  if (amountBase <= 0n || !Number.isSafeInteger(premiumRateBps) || premiumRateBps <= 0) return null;
  return (amountBase * BigInt(premiumRateBps) + 9_999n) / 10_000n;
}

export function pricePer100Label(premiumRateBps: number): string | null {
  const premium = premiumBaseFor(HUNDRED_SKYT_BASE, premiumRateBps);
  if (premium == null) return null;
  const whole = premium / 1_000_000n;
  const fraction = (premium % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return `${whole}.${fraction}`;
}

export function payoutMultipleLabel(premiumRateBps: number): string | null {
  const premium = premiumBaseFor(HUNDRED_SKYT_BASE, premiumRateBps);
  if (premium == null || premium === 0n) return null;
  const tenths = (HUNDRED_SKYT_BASE * 10n) / premium;
  return `${tenths / 10n}.${tenths % 10n}×`;
}

export function chanceLabel(probabilityBps: number): string | null {
  if (!Number.isSafeInteger(probabilityBps) || probabilityBps < 0 || probabilityBps > 10_000) return null;
  return `${(probabilityBps / 100).toFixed(1)}%`;
}

/**
 * Trigger table for one expiry. On-chain rows keep the pinned NOAA terms.
 * Other rows use the same analogue curve and are not buyable.
 */
export function triggerRows(input: {
  totalsMm: readonly number[];
  forecastCumulativeMm: number | null;
  onChainThresholdMm: number | null;
  onChainProbabilityBps: number | null;
  onChainPremiumRateBps: number | null;
}): TriggerRow[] {
  const thresholds = triggerLadderMm(input.totalsMm, input.onChainThresholdMm);
  return thresholds.flatMap((thresholdMm) => {
    const historic = historicHitBps(input.totalsMm, thresholdMm);
    if (historic == null) return [];
    const forecastBps = input.forecastCumulativeMm == null ? null : input.forecastCumulativeMm >= thresholdMm ? 10_000 : 0;
    const model = priceFromSignals(historic, forecastBps);
    const onChain = input.onChainThresholdMm === thresholdMm
      && input.onChainProbabilityBps != null
      && input.onChainPremiumRateBps != null;
    return [{
      thresholdMm,
      probabilityBps: onChain ? input.onChainProbabilityBps! : model.probabilityBps,
      premiumRateBps: onChain ? input.onChainPremiumRateBps! : model.premiumRateBps,
      onChain,
      // Only the buyable on-chain row is highlighted. Coming soon rows stay unselected.
      popular: onChain,
    }];
  });
}
