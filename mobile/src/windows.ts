import type { DevnetStatus } from "./api";
import { expiryLabel, marketsOpenLabel, NEXT_WINDOW_COPY, STRIKE_BASIS, tenorOf, type Tenor } from "../../shared/window-ladder.ts";
import { isOnchainMarketOpen } from "./protection.ts";

export type { Tenor };
export { expiryLabel, marketsOpenLabel, NEXT_WINDOW_COPY, STRIKE_BASIS };

export type SellingWindow = NonNullable<DevnetStatus["cityWindows"]>[number];

/** Open, funded weekly and monthly windows whose sales have not closed. */
export function sellingWindows(status: DevnetStatus | null, nowSeconds: number): SellingWindow[] {
  const fromApi = (status?.cityWindows ?? [])
    .filter((window) => !!window.address && !!window.salesCloseAt && window.salesCloseAt > nowSeconds)
    .slice()
    .sort((left, right) => left.observationStart - right.observationStart);
  if (fromApi.length > 0) return fromApi;
  return legacyDesMoinesWindow(status, nowSeconds);
}

/** Use a legacy market only when its bounds are a real weekly or monthly rung. */
function legacyDesMoinesWindow(status: DevnetStatus | null, nowSeconds: number): SellingWindow[] {
  const market = status?.desMoinesMarket;
  if (!market?.address || !market.marketId || !market.vault) return [];
  if (market.status !== "ready" || market.evidenceStatus !== "validated") return [];
  if (!isOnchainMarketOpen(market.onchainStatus)) return [];
  if (!market.salesCloseAt || market.salesCloseAt <= nowSeconds) return [];
  if (!market.observationStart || !market.observationEnd || market.observationEnd <= market.observationStart) return [];
  if (!market.vaultBalance || !/^\d+$/.test(market.vaultBalance) || BigInt(market.vaultBalance) === 0n) return [];
  if (!market.thresholdMmX100 || !market.operator || market.quoteProbabilityBps == null || market.premiumRateBps == null || !market.quoteInputsHash) return [];
  const tenor = tenorOf(market.observationStart, market.observationEnd);
  if (!tenor) return [];
  return [{
    city: "des-moines",
    tenor,
    status: "ready",
    address: market.address,
    marketId: market.marketId,
    vault: market.vault,
    vaultBalance: market.vaultBalance,
    onchainStatus: market.onchainStatus,
    salesCloseAt: market.salesCloseAt,
    observationStart: market.observationStart,
    observationEnd: market.observationEnd,
    thresholdMmX100: market.thresholdMmX100,
    operator: market.operator,
    quoteProbabilityBps: market.quoteProbabilityBps,
    premiumRateBps: market.premiumRateBps,
    quoteInputsHash: market.quoteInputsHash,
    evidenceStatus: market.evidenceStatus,
  }];
}

export function windowsForTenor(windows: readonly SellingWindow[], tenor: Tenor): SellingWindow[] {
  return windows.filter((window) => window.tenor === tenor);
}

export function soonestWindow(windows: readonly SellingWindow[], tenor: Tenor): SellingWindow | null {
  return windowsForTenor(windows, tenor)[0] ?? null;
}

export function liveMarketLabel(windows: readonly SellingWindow[]): string {
  return marketsOpenLabel(windows.map((window) => window.tenor));
}

export function windowsForCity(windows: readonly SellingWindow[], city: SellingWindow["city"]): SellingWindow[] {
  return windows.filter((window) => window.city === city);
}

/** True when this city's latest market exists and its sales have already closed. */
export function citySalesClosed(status: DevnetStatus | null, city: SellingWindow["city"], nowSeconds: number): boolean {
  if (city !== "des-moines") return false;
  const market = status?.desMoinesMarket;
  if (!market?.salesCloseAt || market.salesCloseAt > nowSeconds) return false;
  return windowsForCity(sellingWindows(status, nowSeconds), city).length === 0;
}

export function cityChip(windows: readonly SellingWindow[], salesClosed: boolean): { label: string; tone: "live" | "soon" | "closed" } {
  if (windows.length > 0) {
    const label = liveMarketLabel(windows);
    return { label, tone: label === NEXT_WINDOW_COPY ? "soon" : "live" };
  }
  return salesClosed ? { label: "Sales closed", tone: "closed" } : { label: NEXT_WINDOW_COPY, tone: "soon" };
}

export function positionLabel(marketAddress: string, windows: readonly SellingWindow[], fallbackAddress: string | null): string | null {
  const match = windows.find((window) => window.address === marketAddress);
  if (match) return `Des Moines · ${expiryLabel(match)}`;
  if (fallbackAddress && marketAddress === fallbackAddress) return "Des Moines · Rain";
  return null;
}

export function basisLine(station: string, tenor: Tenor): string {
  return `Basis · NOAA ${station} · ${STRIKE_BASIS} · ${tenor}`;
}
