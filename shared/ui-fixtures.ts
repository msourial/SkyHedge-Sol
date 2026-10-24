/**
 * FIXTURE — not a live quote and not used by the product data path.
 * Triggers and chances are the spec's New York week.
 * Premiums are the protocol curve (15% on the chance, then the 1% fee) at 50, 100 and 250.
 * Only the preview route and tests import this file.
 */
import { priceFromSignals } from "./window-ladder.ts";
import { premiumMapFromRate, ticketFromBases, coverBase, premiumFromRate } from "./ui-money.ts";
import type { RungQuote, WindowQuote } from "./ui-quote-types.ts";

const NYC_LADDER = [
  { trigger: 47, chanceBps: 6_000 },
  { trigger: 50, chanceBps: 5_000 },
  { trigger: 56, chanceBps: 4_000 },
  { trigger: 69, chanceBps: 2_000 },
  { trigger: 84, chanceBps: 2_000 },
  { trigger: 114, chanceBps: 1_000 },
] as const;

const PINNED_TRIGGER = 69;

function rung(trigger: number, chanceBps: number, open: boolean): RungQuote {
  const rate = priceFromSignals(chanceBps, null).premiumRateBps;
  const payout = coverBase(100)!;
  const premium = premiumFromRate(100, rate)!;
  const deal = ticketFromBases(premium, payout)!;
  const map = premiumMapFromRate(rate)!;
  return {
    triggerValue: trigger,
    chanceBps,
    premiumBase: open ? map : "0",
    payoutBase: payout.toString(),
    multipleTenths: deal.multipleTenths,
    marketAddress: open ? `fixture-${trigger}` : null,
    isTopRung: trigger === 114,
  };
}

export const FIXTURE_NOTE = "Fixture";

/** Option B: every rung is its own market. */
export const NYC_RAIN_OPTION_B: WindowQuote = {
  peril: "rain",
  cityId: "new-york",
  stationId: "GHCND:USW00094728",
  windowStart: "2026-10-26",
  windowEnd: "2026-11-02",
  salesCloseAt: "2026-10-26",
  analogueYears: 10,
  unit: "mm",
  rungs: NYC_LADDER.map((row) => rung(row.trigger, row.chanceBps, true)),
};

/** Current backend shape: one open rung, five modelled. */
export const NYC_RAIN_MODELLED: WindowQuote = {
  ...NYC_RAIN_OPTION_B,
  rungs: NYC_LADDER.map((row) => rung(row.trigger, row.chanceBps, row.trigger === PINNED_TRIGGER)),
};

export const FIXTURE_PINNED_TRIGGER = PINNED_TRIGGER;

/** Silhouette checks for the other instruments. Not a quote and not shown as a market. */
export const FIXTURE_SILHOUETTE = {
  snow: [8, 14, 22, 31, 46, 70],
  wind: [6, 8, 10, 12, 14, 18],
  heat: [27, 28, 29, 30, 31, 33],
  cold: [0, 2, 4, 6, 8, 10],
} as const;
