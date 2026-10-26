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

/** Choose dates from the live window when present; all prices come from the API. */
export function windowQuoteRequest(input: {
  cityId: string;
  peril: PerilId;
  tenor: "weekly" | "monthly";
  windows: readonly QuoteWindow[];
  nowSeconds: number;
}) {
  const window = input.windows
    .filter((item) => item.city === input.cityId && (item.peril ?? "rain") === input.peril && item.tenor === input.tenor)
    .filter((item) => (item.salesCloseAt ?? item.observationStart) > input.nowSeconds)
    .sort((a, b) => a.observationStart - b.observationStart)[0];
  const next = upcomingWindow(input.nowSeconds * 1000, input.tenor);
  const start = window ? isoFromSeconds(window.observationStart) ?? next.start : next.start;
  const end = window ? isoFromSeconds(window.observationEnd) ?? next.end : next.end;
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
