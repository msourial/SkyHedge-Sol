/**
 * Customer pay versus payout. Figures come only from a pinned premium rate
 * and a chosen coverage amount. The chips are the payout, not the price.
 */
import { chanceLabel, premiumBaseFor } from "./window-chain.ts";

const BASE = 1_000_000n;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type PayGet = {
  payBase: string;
  getBase: string;
  payLabel: string;
  getLabel: string;
  multiple: string;
  chance: string;
};

export function payGet(input: { coverageSkyt: number; premiumRateBps: number; probabilityBps: number }): PayGet | null {
  if (!Number.isInteger(input.coverageSkyt) || input.coverageSkyt <= 0) return null;
  const getBase = BigInt(input.coverageSkyt) * BASE;
  const payBase = premiumBaseFor(getBase, input.premiumRateBps);
  const chance = chanceLabel(input.probabilityBps);
  if (payBase == null || payBase <= 0n || chance == null) return null;
  const tenths = (getBase * 10n) / payBase;
  return {
    payBase: payBase.toString(),
    getBase: getBase.toString(),
    payLabel: twoDecimals(payBase),
    getLabel: String(input.coverageSkyt),
    multiple: `${tenths / 10n}.${tenths % 10n}×`,
    chance,
  };
}

export function protectCta(input: { connected: boolean; quote: PayGet | null; thresholdMm: number | null }): string {
  if (!input.connected) return "Connect wallet";
  if (!input.quote || input.thresholdMm == null) return "Pick a trigger";
  return `Protect ${input.quote.getLabel} SKYT · pay ${input.quote.payLabel}`;
}

export function notTriggeredLine(observedMm: number, triggerMm: number): string | null {
  if (!Number.isFinite(observedMm) || !Number.isFinite(triggerMm) || triggerMm <= 0 || observedMm >= triggerMm) return null;
  return `Not triggered: ${millimetres(observedMm)} of ${millimetres(triggerMm)} mm`;
}

export function confirmSentence(input: { thresholdMm: number; station: string; expiry: string; getLabel: string }): string {
  const place = input.station.replace(/^NOAA\s+/i, "");
  return `If ≥${input.thresholdMm} mm falls at ${place} by ${input.expiry}, you get ${input.getLabel} SKYT`;
}

export type MarketStatus = { tone: "open" | "opens" | "closed"; label: string };

/** Open while sales are live. A future observation start is the only "Opens" date. */
export function marketStatus(
  windows: readonly { salesCloseAt: number | null; observationStart: number }[],
  nowSeconds: number,
): MarketStatus | null {
  if (windows.some((window) => window.salesCloseAt != null && window.salesCloseAt > nowSeconds)) return { tone: "open", label: "Open" };
  const next = windows.filter((window) => window.observationStart > nowSeconds).sort((left, right) => left.observationStart - right.observationStart)[0];
  if (next) return { tone: "opens", label: `Opens ${utcDay(next.observationStart)}` };
  if (windows.some((window) => window.salesCloseAt != null && window.salesCloseAt <= nowSeconds)) return { tone: "closed", label: "Closed" };
  return null;
}

function twoDecimals(base: bigint): string {
  const whole = base / BASE;
  const fraction = (base % BASE).toString().padStart(6, "0").slice(0, 2);
  return `${whole}.${fraction}`;
}

function millimetres(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function utcDay(seconds: number): string {
  const date = new Date(seconds * 1000);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** Bar widths (0–1) drawn to scale against the payout. The pay bar keeps a 4% sliver so it stays visible. */
export function payGetBarWidths(payBase: string | null | undefined, getBase: string | null | undefined): { pay: number; get: number } | null {
  if (!payBase || !getBase || !/^\d+$/.test(payBase) || !/^\d+$/.test(getBase)) return null;
  const pay = BigInt(payBase);
  const get = BigInt(getBase);
  if (get <= 0n || pay <= 0n) return null;
  const larger = pay > get ? pay : get;
  const ratio = (value: bigint) => Number((value * 10_000n) / larger) / 10_000;
  return { pay: Math.max(0.04, ratio(pay)), get: Math.max(0.04, ratio(get)) };
}
