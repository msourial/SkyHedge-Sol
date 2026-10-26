import { NOAA_STATIONS, type SkyHedgeCity } from "./noaa.js";
import { ANALOGUE_YEARS } from "../../shared/window-ladder.js";
import { PERILS, perilOpenForCity, type PerilId } from "../../shared/perils.js";
import {
  multipleTenthsFor,
  premiumBaseMap,
  priceFromHitCount,
  RUNG_PAYOUT_BASE,
  selectRungThresholds,
} from "../../shared/rung-plan.js";
import { isValidImmutableMarketPricingTerms } from "../../shared/market-pricing.js";
import type { RungQuote, WindowQuote } from "../../shared/ui-quote-types.js";

export interface WindowQuoteMarket {
  scaledX100: number;
  address: string;
  operator: "gt" | "gte" | "lt" | "lte" | null;
  probabilityBps?: number | null;
  premiumRateBps?: number | null;
  quoteInputsHash?: string | null;
}

export class PerilNotOpenError extends Error {
  readonly code = "PERIL_NOT_OPEN";
  constructor(message: string) { super(message); }
}

export class PerilNotAvailableError extends Error {
  readonly code = "PERIL_NOT_AVAILABLE";
  constructor(message: string) { super(message); }
}

/**
 * Modelled rungs are priced with the same curve and carry a null market address.
 * An open market keeps its pinned probability instead of a fresh price.
 */
export function buildWindowQuote(input: {
  peril: PerilId;
  cityId: string;
  stationId: string;
  windowStart: string;
  windowEnd: string;
  salesCloseAt: string;
  totalTenths: readonly number[];
  forecastNative: number | null;
  markets: readonly WindowQuoteMarket[];
}): WindowQuote {
  const spec = PERILS[input.peril];
  if (!spec.open) throw new PerilNotOpenError(spec.closedReason ?? "This peril is not open");
  if (!perilOpenForCity(input.peril, input.cityId)) {
    throw new PerilNotAvailableError(`${spec.label} is not open for this city.`);
  }
  if (input.totalTenths.length !== ANALOGUE_YEARS) {
    throw new Error("NOAA analogue history is incomplete.");
  }
  const thresholds = selectRungThresholds(input.totalTenths, spec.strikeRounding);
  const rungs: RungQuote[] = thresholds.flatMap((rung) => {
    const market = input.markets.find((candidate) => candidate.operator === "gte" && candidate.scaledX100 === rung.scaledX100 && candidate.address);
    const pinned = market
      && market.probabilityBps != null
      && market.premiumRateBps != null
      && market.quoteInputsHash
      && isValidImmutableMarketPricingTerms({
        probabilityBps: market.probabilityBps,
        premiumRateBps: market.premiumRateBps,
        inputsHash: market.quoteInputsHash,
      })
      ? { probabilityBps: market.probabilityBps, premiumRateBps: market.premiumRateBps }
      : null;
    const priced = pinned ?? priceFromHitCount(rung.hits, input.forecastNative, rung.triggerValue);
    if (!priced) return [];
    const premiumBase = premiumBaseMap(priced.premiumRateBps);
    const multipleTenths = multipleTenthsFor(priced.premiumRateBps);
    if (!premiumBase || multipleTenths == null) return [];
    return [{
      triggerValue: rung.triggerValue,
      chanceBps: priced.probabilityBps,
      premiumBase,
      payoutBase: RUNG_PAYOUT_BASE.toString(),
      multipleTenths,
      marketAddress: market?.address ?? null,
      isTopRung: false,
    }];
  });
  const top = rungs.reduce((best, rung) => rung.triggerValue > best ? rung.triggerValue : best, 0);
  for (const rung of rungs) rung.isTopRung = rung.triggerValue === top && top > 0;
  return {
    peril: input.peril,
    cityId: input.cityId,
    stationId: input.stationId,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    salesCloseAt: input.salesCloseAt,
    analogueYears: input.totalTenths.length,
    unit: spec.unit,
    rungs,
  };
}

export function salesCloseIso(windowStart: string): string {
  return `${windowStart}T00:00:00.000Z`;
}

export function stationIdFor(city: SkyHedgeCity): string {
  return NOAA_STATIONS[city].stationId;
}
