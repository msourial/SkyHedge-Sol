import { perilOpen } from "./peril-registry.ts";
import { isoFromSeconds, upcomingWindow } from "./ui-ladder.ts";
import type { PerilId, WindowQuote } from "./ui-types.ts";

export type QuoteWindow = {
  city: string;
  peril?: PerilId;
  tenor: "weekly" | "monthly";
  address: string;
  observationStart: number;
  observationEnd: number;
  salesCloseAt: number | null;
};

export type Tenor = QuoteWindow["tenor"];
export type TenorAvailability = Record<Tenor, boolean>;

/** Registry eligibility alone is not an open sale: require a live window too. */
export function pickDefaultWindow(input: {
  cityId: string;
  peril: PerilId;
  windows: readonly QuoteWindow[];
  nowSeconds: number;
}): { tenor: Tenor | null; window: QuoteWindow | null; tenorAvailability: TenorAvailability } {
  const windows = openQuoteWindows(input);
  const weekly = windows.find((window) => window.tenor === "weekly");
  const monthly = windows.find((window) => window.tenor === "monthly");
  const window = weekly ?? monthly ?? null;
  return { tenor: window?.tenor ?? null, window, tenorAvailability: { weekly: !!weekly, monthly: !!monthly } };
}

export function openQuoteWindows(input: {
  cityId: string;
  peril: PerilId;
  windows: readonly QuoteWindow[];
  nowSeconds: number;
}): QuoteWindow[] {
  return input.windows.filter((window) => {
    const start = isoFromSeconds(window.observationStart);
    return input.peril !== "cold" && window.city === input.cityId && (window.peril ?? "rain") === input.peril
      && !!window.address && start != null && window.observationEnd > window.observationStart
      && (window.salesCloseAt ?? window.observationStart) > input.nowSeconds
      && perilOpen({ cityId: input.cityId, peril: input.peril, windowStart: start, tenor: window.tenor });
  }).sort((a, b) => a.observationStart - b.observationStart);
}

/** Choose dates from the live window when present; all prices come from the API. */
export function windowQuoteRequest(input: {
  cityId: string;
  peril: PerilId;
  tenor: "weekly" | "monthly";
  windows: readonly QuoteWindow[];
  nowSeconds: number;
  selectedWindow?: { start: string; end: string } | null;
}) {
  const window = openQuoteWindows(input).find((item) => item.tenor === input.tenor);
  const next = upcomingWindow(input.nowSeconds * 1000, input.tenor);
  const start = input.selectedWindow?.start ?? (window ? isoFromSeconds(window.observationStart) ?? next.start : next.start);
  const end = input.selectedWindow?.end ?? (window ? isoFromSeconds(window.observationEnd) ?? next.end : next.end);
  const available = input.peril !== "cold" && perilOpen({ ...input, windowStart: start });
  const params = new URLSearchParams({ resource: "window-quote", city: input.cityId, peril: input.peril, windowStart: start, windowEnd: end });
  return { start, end, path: available ? `/api/mobile?${params}` : null };
}

/** Refuse a cached or misrouted quote for a different selection. */
export function matchingQuote(quote: WindowQuote | null | undefined, input: {
  cityId: string; peril: PerilId; start: string; end: string;
}): WindowQuote | null {
  return input.peril !== "cold" && quote?.cityId === input.cityId && quote.peril === input.peril
    && quote.windowStart === input.start && quote.windowEnd === input.end ? quote : null;
}

export function quoteNotOpen(error: unknown): boolean {
  return error instanceof Error && "status" in error && error.status === 409;
}
