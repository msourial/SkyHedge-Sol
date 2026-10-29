/** UI aliases derived from the authoritative backend quote contract. */
import type { RungQuote, WindowQuotePeril } from "./ui-quote-types.js";
import { WINDOW_QUOTE_COVER_SKYT } from "./ui-quote-types.js";

export type { RungQuote, WindowQuote } from "./ui-quote-types.js";
export type PerilId = WindowQuotePeril;
export type CoverSize = (typeof WINDOW_QUOTE_COVER_SKYT)[number];
export type PremiumByCover = RungQuote["premiumBase"];

export function rungTrigger(rung: RungQuote): number | null {
  return Number.isFinite(rung.triggerValue) ? rung.triggerValue : null;
}
