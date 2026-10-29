/**
 * Turns a backend WindowQuote into chain figures.
 * Modelled rungs keep chance and multiple and never receive a max loss.
 */
import { cityById } from "./peril-registry.ts";
import {
  displayUnit,
  chanceLabel,
  formatBaseGrouped,
  measureLabel,
  multipleLabel,
  rungEconomics,
  ticketFromBases,
} from "./ui-money.ts";
import { rungTrigger, type CoverSize, type PerilId, type RungQuote, type WindowQuote } from "./ui-types.ts";

export { payoffPixels } from "./ui-money.ts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dayFromIso(iso: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${Number(match[3])}` : null;
}

export function isoFromSeconds(seconds: number): string | null {
  if (!Number.isSafeInteger(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

export function scaleFor(peril: PerilId, triggers: readonly number[]): { min: number; max: number } {
  if (!triggers.length) return { min: 0, max: 1 };
  const hi = Math.max(...triggers);
  const lo = Math.min(...triggers);
  if (peril === "heat" || peril === "cold") {
    const span = hi - lo || Math.abs(hi) || 1;
    return { min: lo - 0.2 * span, max: hi + 0.2 * span };
  }
  const top = hi * 1.2;
  return { min: 0, max: top > 0 ? top : 1 };
}

export function fractionOnScale(value: number, scale: { min: number; max: number }): number {
  const span = scale.max - scale.min;
  if (!(span > 0) || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, (value - scale.min) / span));
}

export type ChainFigures = {
  trigger: number;
  triggerLabel: string;
  chance: string;
  multiple: string;
  maxLoss: string | null;
  open: boolean;
  top: boolean;
};

/** Lowest trigger first. Max loss comes from the premium, never from the multiple. */
export function chainFigures(quote: WindowQuote, cover: CoverSize): ChainFigures[] {
  const unit = displayUnit(quote.unit);
  return [...quote.rungs]
    .map((rung) => figuresFor(rung, cover, unit))
    .filter((row): row is ChainFigures => row != null)
    .sort((left, right) => left.trigger - right.trigger);
}

function figuresFor(rung: RungQuote, cover: CoverSize, unit: string): ChainFigures | null {
  const trigger = rungTrigger(rung);
  const chance = chanceLabel(rung.chanceBps);
  const measured = trigger == null ? null : measureLabel(trigger);
  if (trigger == null || !chance || !measured) return null;
  const triggerLabel = `${measured} ${unit}`;
  if (!rung.marketAddress) {
    const multiple = multipleLabel(rung.multipleTenths);
    if (!multiple) return null;
    return { trigger, triggerLabel, chance, multiple, maxLoss: null, open: false, top: rung.isTopRung };
  }
  const economics = rungEconomics(rung, cover);
  if (!economics) return null;
  const deal = ticketFromBases(economics.premium, economics.payout);
  if (!deal) return null;
  const multiple = multipleLabel(deal.multipleTenths);
  if (!multiple) return null;
  return {
    trigger,
    triggerLabel,
    chance,
    multiple,
    maxLoss: formatLoss(deal.maxLoss),
    open: true,
    top: rung.isTopRung,
  };
}

function formatLoss(base: bigint): string {
  return `-${formatBaseGrouped(base)}`;
}

export function stationFor(cityId: string): string {
  return cityById(cityId)?.station ?? "Station";
}

/** Next window whose sales have not closed. Sales close at the window start. */
export function upcomingWindow(nowMs: number, tenor: "weekly" | "monthly"): { start: string; end: string } {
  const now = new Date(nowMs);
  if (tenor === "monthly") {
    const startMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
    const endMs = Date.UTC(new Date(startMs).getUTCFullYear(), new Date(startMs).getUTCMonth() + 1, 1);
    return { start: new Date(startMs).toISOString().slice(0, 10), end: new Date(endMs).toISOString().slice(0, 10) };
  }
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const mondayOffset = (new Date(day).getUTCDay() + 6) % 7;
  const thisMonday = day - mondayOffset * 86_400_000;
  const startMs = nowMs >= thisMonday ? thisMonday + 7 * 86_400_000 : thisMonday;
  return { start: new Date(startMs).toISOString().slice(0, 10), end: new Date(startMs + 7 * 86_400_000).toISOString().slice(0, 10) };
}
