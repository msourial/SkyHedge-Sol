/**
 * UI ↔ quote contract for the multi-peril chain.
 *
 * The backend agent adapts its output to these types. Keep them small.
 * Readers must not invent a premium, a chance, or a year count.
 *
 * - `marketAddress: null` means the rung is modelled: chance and multiple
 *   may be shown, it cannot be bought, and it has no max loss.
 * - `premiumBase` is an exact integer in SKYT base units (6 decimals).
 *   A string is the premium for one cover. A map is the premium at 50, 100
 *   and 250. Never derive it from `multipleTenths` (that figure is truncated).
 * - `payoutBase` is the gross payout in base units for the string premium.
 *   When `premiumBase` is a map, the payout is the cover size itself.
 * - `triggerMm` and `triggerValue` are the same native NOAA unit. Rain and
 *   snow may send either name. No unit conversion happens in the UI.
 * - `analogueYears` is the history length for the required chance note.
 *   The UI does not substitute a constant when it is missing.
 */
export type PerilId = "rain" | "snow" | "wind" | "heat" | "cold";

export type CoverSize = 50 | 100 | 250;

export type PremiumByCover = Record<CoverSize, string>;

export type RungQuote = {
  triggerMm?: number;
  triggerValue?: number;
  chanceBps: number;
  premiumBase: string | PremiumByCover;
  payoutBase: string;
  /** Payout ÷ premium, truncated to tenths. 41 means 4.1x. */
  multipleTenths: number;
  marketAddress: string | null;
  isTopRung: boolean;
};

export type WindowQuote = {
  peril: PerilId;
  cityId: string;
  stationId: string;
  /** ISO date or instant. Sales close at `salesCloseAt`, which is the window start. */
  windowStart: string;
  windowEnd: string;
  salesCloseAt: string;
  analogueYears: number;
  rungs: RungQuote[];
  /** NOAA native unit label, e.g. "mm", "m/s", "C". */
  unit: string;
};

export function rungTrigger(rung: { triggerMm?: number; triggerValue?: number }): number | null {
  const value = rung.triggerValue ?? rung.triggerMm;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}
