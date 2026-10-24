import { NOAA_STATIONS, DataUnavailableError, type SkyHedgeCity } from "./noaa.js";
import { isPerilId, PERILS, perilOpenForCity, type PerilId } from "../../shared/perils.js";
import { loadAnalogueSeries } from "./demo-keeper-plan.js";
import { buildWindowQuote, PerilNotAvailableError, PerilNotOpenError, salesCloseIso, type WindowQuoteMarket } from "./window-quote.js";
import type { DevnetStatus } from "./devnet-status.js";
import type { WindowQuote } from "../../shared/ui-quote-types.js";

export interface WindowQuoteQuery {
  peril: string;
  cityId: string;
  windowStart: string;
  windowEnd: string;
}

/**
 * History-only WindowQuote from the committed GHCN analogue totals.
 * An open market attaches its address. A modelled rung stays null and is not buyable.
 */
export async function readCatalogueWindowQuote(input: WindowQuoteQuery & {
  markets?: readonly WindowQuoteMarket[];
  series?: ReturnType<typeof loadAnalogueSeries>;
  forecastNative?: number | null;
}): Promise<WindowQuote> {
  if (!isPerilId(input.peril)) throw new DataUnavailableError("Unknown peril.");
  const peril = input.peril;
  const spec = PERILS[peril];
  if (!spec.open) throw new PerilNotOpenError(spec.closedReason ?? "This peril is not open");
  if (!(input.cityId in NOAA_STATIONS) || !perilOpenForCity(peril, input.cityId)) {
    throw new PerilNotAvailableError(`${spec.label} is not open for this city.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.windowStart) || !/^\d{4}-\d{2}-\d{2}$/.test(input.windowEnd) || input.windowStart >= input.windowEnd) {
    throw new DataUnavailableError("The observation window must be a nonempty half-open UTC date range.");
  }
  const series = input.series ?? loadAnalogueSeries();
  const row = series.find((item) => item.city === input.cityId && item.peril === peril && item.windowStart === input.windowStart && item.windowEnd === input.windowEnd);
  if (row?.error || !row?.totalTenths) {
    throw new DataUnavailableError(row?.error ?? "NOAA analogue history for this window is not in the committed GHCN set.");
  }
  return buildWindowQuote({
    peril,
    cityId: input.cityId,
    stationId: NOAA_STATIONS[input.cityId as SkyHedgeCity].stationId,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    salesCloseAt: salesCloseIso(input.windowStart),
    totalTenths: row.totalTenths,
    forecastNative: input.forecastNative ?? null,
    markets: input.markets ?? [],
  });
}

export async function marketsForWindowQuote(
  readStatus: () => Promise<DevnetStatus>,
  city: string,
  peril: PerilId,
  windowStart: string,
  windowEnd: string,
): Promise<WindowQuoteMarket[]> {
  try {
    const status = await readStatus();
    return (status.cityWindows ?? []).flatMap((window) => {
      if (window.city !== city || (window.peril ?? "rain") !== peril) return [];
      const start = new Date(window.observationStart * 1_000).toISOString().slice(0, 10);
      const end = new Date(window.observationEnd * 1_000).toISOString().slice(0, 10);
      if (start !== windowStart || end !== windowEnd || !window.address || !window.thresholdMmX100) return [];
      const scaledX100 = Number(window.thresholdMmX100);
      if (!Number.isSafeInteger(scaledX100)) return [];
      return [{
        scaledX100,
        address: window.address,
        operator: window.operator,
        probabilityBps: window.quoteProbabilityBps,
        premiumRateBps: window.premiumRateBps,
        quoteInputsHash: window.quoteInputsHash,
      }];
    });
  } catch {
    return [];
  }
}
