/** Perils the quote surface can name. Cold is registered and not open. */
export type WindowQuotePeril = "rain" | "snow" | "wind" | "heat" | "cold";

/** Whole-SKYT cover sizes priced on every rung. SKYT base units use 6 decimals. */
export const WINDOW_QUOTE_COVER_SKYT = [50, 100, 250] as const;

export interface RungQuote {
  /** Trigger in the peril's native unit (mm, m/s, or degrees C). */
  triggerValue: number;
  chanceBps: number;
  /**
   * Exact integer premium in SKYT base units, keyed by cover size in whole SKYT.
   * "50" is the premium for 50 SKYT of cover, and likewise for 100 and 250.
   */
  premiumBase: Record<"50" | "100" | "250", string>;
  /** Payout in SKYT base units for the 100 SKYT cover. multipleTenths uses this notional. */
  payoutBase: string;
  /** floor(100 SKYT base units * 10 / that cover's premium). 41 means 4.1×. */
  multipleTenths: number;
  /** Null when this rung is only modelled. A null rung cannot be purchased. */
  marketAddress: string | null;
  isTopRung: boolean;
}

export interface WindowQuote {
  peril: WindowQuotePeril;
  cityId: string;
  stationId: string;
  /** Inclusive UTC date, YYYY-MM-DD. */
  windowStart: string;
  /** Exclusive UTC date, YYYY-MM-DD. Same bound as the purchase quote. */
  windowEnd: string;
  /** ISO-8601 UTC instant when sales close. Equal to the observation start. */
  salesCloseAt: string;
  /** Analogue years actually scored for this window. */
  analogueYears: number;
  unit: string;
  rungs: RungQuote[];
}
