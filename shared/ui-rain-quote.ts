/**
 * Turns one live rain window plus its evidence package into a WindowQuote.
 * Year count is the analogue array length from the response. No constant is filled in.
 */
import { matchingWindowPackage, triggerRows, type WindowEvidencePackage } from "./window-chain.ts";
import { isoFromSeconds, quoteFromTriggerRows } from "./ui-ladder.ts";
import type { WindowQuote } from "./ui-quote-types.ts";

export type RainWindow = {
  city: string;
  tenor: "weekly" | "monthly";
  address: string;
  observationStart: number;
  observationEnd: number;
  thresholdMmX100: string | null;
  quoteProbabilityBps: number | null;
  premiumRateBps: number | null;
  salesCloseAt: number | null;
};

export function soonestWindow(windows: readonly RainWindow[], cityId: string, tenor: "weekly" | "monthly", nowSeconds: number): RainWindow | null {
  const open = windows
    .filter((window) => window.city === cityId && window.tenor === tenor)
    .filter((window) => window.salesCloseAt == null || window.salesCloseAt > nowSeconds)
    .sort((left, right) => left.observationStart - right.observationStart);
  return open[0] ?? null;
}

export function rainQuoteForWindow(window: RainWindow, packages: readonly WindowEvidencePackage[] | null | undefined): { quote: WindowQuote | null; defaultTrigger: number | null } {
  const threshold = window.thresholdMmX100 && /^\d+$/.test(window.thresholdMmX100) ? Number(window.thresholdMmX100) / 100 : null;
  const start = isoFromSeconds(window.observationStart);
  const end = isoFromSeconds(window.observationEnd);
  const sales = isoFromSeconds(window.salesCloseAt ?? window.observationStart);
  if (!start || !end || !sales) return { quote: null, defaultTrigger: threshold };
  const pkg = matchingWindowPackage(packages, window.city, window.observationStart, window.observationEnd);
  if (!pkg || pkg.analogueTotalsMm.length < 1) return { quote: null, defaultTrigger: threshold };
  const rows = triggerRows({
    totalsMm: pkg.analogueTotalsMm,
    forecastCumulativeMm: pkg.forecastCumulativeMm,
    onChainThresholdMm: threshold,
    onChainProbabilityBps: window.quoteProbabilityBps,
    onChainPremiumRateBps: window.premiumRateBps,
  });
  const quote = quoteFromTriggerRows({
    cityId: window.city,
    stationId: pkg.stationId,
    windowStart: start,
    windowEnd: end,
    salesCloseAt: sales,
    analogueYears: pkg.analogueTotalsMm.length,
    marketAddress: window.address,
    rows,
  });
  return { quote, defaultTrigger: threshold };
}
