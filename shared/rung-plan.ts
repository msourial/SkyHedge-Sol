import { ANALOGUE_YEARS, priceFromSignals, type LadderWindow, type LiveCitySlug } from "./window-ladder.js";
import { premiumBaseFor } from "./window-chain.js";
import { PERILS, type PerilId, type StrikeRounding } from "./perils.js";
import type { RungQuote } from "./ui-quote-types.js";

/** Default buyable rungs: 6th, 8th and 10th of the ten analogue totals. */
export const RUNG_RANKS = [6, 8, 10] as const;
export const COVER_BASE_UNITS = {
  "50": 50_000_000n,
  "100": 100_000_000n,
  "250": 250_000_000n,
} as const;
/** Payout notional used for multipleTenths. 100 SKYT. */
export const RUNG_PAYOUT_BASE = COVER_BASE_UNITS["100"];

export interface RungThreshold {
  rank: number;
  /** Native unit (mm, m/s, or degrees C). */
  triggerValue: number;
  /** Integer tenths of the native unit. */
  triggerTenths: number;
  /** On-chain i64. triggerValue × 100. */
  scaledX100: number;
  hits: number;
}

export interface ExistingRung {
  city: string;
  peril: PerilId;
  observationStart: number;
  observationEnd: number;
  scaledX100: number;
  operator: "gt" | "gte" | "lt" | "lte";
  state: "draft" | "open" | "cancelled" | "other";
  address?: string;
  marketId?: string;
  vaultBalanceBase?: string | null;
  probabilityBps?: number | null;
  premiumRateBps?: number | null;
}

export type RungAction = "create-fund-open" | "fund-open" | "open" | "keep";

export interface PlannedRungStep {
  action: RungAction;
  city: LiveCitySlug;
  peril: PerilId;
  window: LadderWindow;
  rank: number;
  triggerValue: number;
  scaledX100: number;
  hits: number;
  existing?: ExistingRung;
}

/** Ceil a non-negative tenth-count up to a whole native unit, expressed back in tenths. */
export function ceilWholeTenths(tenths: number): number {
  if (!Number.isInteger(tenths) || tenths < 0) return Number.NaN;
  return Math.floor((tenths + 9) / 10) * 10;
}

/**
 * Ranks 6, 8 and 10. Whole-unit perils ceil like strikeFromAnalogueTotals.
 * Temperature and wind stay on tenths. Non-positive strikes are skipped.
 * Ranks that ceil to the same strike collapse to one rung.
 */
export function selectRungThresholds(
  totalTenths: readonly number[],
  rounding: StrikeRounding,
  ranks: readonly number[] = RUNG_RANKS,
): RungThreshold[] {
  if (totalTenths.length !== ANALOGUE_YEARS) return [];
  if (totalTenths.some((value) => !Number.isInteger(value) || value < 0)) return [];
  const sorted = [...totalTenths].sort((left, right) => left - right);
  const chosen: RungThreshold[] = [];
  const seen = new Set<number>();
  for (const rank of ranks) {
    const raw = sorted[rank - 1];
    if (raw == null) continue;
    const triggerTenths = rounding === "whole" ? ceilWholeTenths(raw) : raw;
    if (!Number.isInteger(triggerTenths) || triggerTenths <= 0 || seen.has(triggerTenths)) continue;
    seen.add(triggerTenths);
    const hits = totalTenths.filter((value) => value >= triggerTenths).length;
    chosen.push({
      rank,
      triggerValue: triggerTenths / 10,
      triggerTenths,
      scaledX100: triggerTenths * 10,
      hits,
    });
  }
  return chosen;
}

export function priceFromHitCount(hits: number, forecastNative: number | null, triggerValue: number): {
  probabilityBps: number;
  premiumRateBps: number;
  forecastWeight: number;
} | null {
  if (!Number.isInteger(hits) || hits < 0 || hits > ANALOGUE_YEARS) return null;
  if (!Number.isFinite(triggerValue) || triggerValue <= 0) return null;
  const historic = Math.round((hits / ANALOGUE_YEARS) * 10_000);
  const forecastBps = forecastNative == null ? null : forecastNative >= triggerValue ? 10_000 : 0;
  return priceFromSignals(historic, forecastBps);
}

export function premiumBaseMap(premiumRateBps: number): RungQuote["premiumBase"] | null {
  const premiums = {
    "50": premiumBaseFor(COVER_BASE_UNITS["50"], premiumRateBps),
    "100": premiumBaseFor(COVER_BASE_UNITS["100"], premiumRateBps),
    "250": premiumBaseFor(COVER_BASE_UNITS["250"], premiumRateBps),
  };
  if (premiums["50"] == null || premiums["100"] == null || premiums["250"] == null) return null;
  return {
    "50": premiums["50"].toString(),
    "100": premiums["100"].toString(),
    "250": premiums["250"].toString(),
  };
}

export function multipleTenthsFor(premiumRateBps: number): number | null {
  const premium = premiumBaseFor(RUNG_PAYOUT_BASE, premiumRateBps);
  if (premium == null || premium === 0n) return null;
  return Number((RUNG_PAYOUT_BASE * 10n) / premium);
}

/**
 * One market per rung. An existing non-cancelled market with the same city,
 * peril, window, threshold and operator is not created again and is not repriced.
 */
export function planMissingRungs(
  existing: readonly ExistingRung[],
  city: LiveCitySlug,
  peril: PerilId,
  window: LadderWindow,
  rungs: readonly RungThreshold[],
): PlannedRungStep[] {
  const steps: PlannedRungStep[] = [];
  for (const rung of rungs) {
    const matches = existing.filter((market) => market.state !== "cancelled"
      && market.city === city
      && market.peril === peril
      && market.observationStart === window.observationStart
      && market.observationEnd === window.observationEnd
      && market.scaledX100 === rung.scaledX100
      && market.operator === "gte");
    const base = {
      city,
      peril,
      window,
      rank: rung.rank,
      triggerValue: rung.triggerValue,
      scaledX100: rung.scaledX100,
      hits: rung.hits,
    };
    if (matches.length === 0) {
      steps.push({ action: "create-fund-open", ...base });
      continue;
    }
    const open = matches.find((market) => market.state === "open" || market.state === "other");
    if (open) {
      steps.push({ action: "keep", ...base, existing: open });
      continue;
    }
    const draft = matches.find((market) => market.state === "draft" && market.marketId && market.address);
    if (!draft) {
      steps.push({ action: "keep", ...base, existing: matches[0] });
      continue;
    }
    const funded = !!draft.vaultBalanceBase && /^\d+$/.test(draft.vaultBalanceBase) && BigInt(draft.vaultBalanceBase) > 0n;
    steps.push({ action: funded ? "open" : "fund-open", ...base, existing: draft });
  }
  return steps;
}

export function perilRounding(peril: PerilId): StrikeRounding {
  return PERILS[peril].strikeRounding;
}
