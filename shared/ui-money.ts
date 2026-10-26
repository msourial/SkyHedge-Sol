/**
 * Integer SKYT base units only. Display strings are sliced from those integers.
 * Premiums are never derived from a truncated multiple.
 */
import { COVER_SIZES, MARKET_CAP_SKYT, SKYT_BASE } from "./ui-tokens.ts";
import type { CoverSize, PremiumByCover, RungQuote } from "./ui-types.ts";

export { COVER_SIZES, MARKET_CAP_SKYT, SKYT_BASE };

/** Ceil(amount × bps / 10_000). Same rounding as the on-chain premium. */
export function ceilBps(amount: bigint, bps: number): bigint | null {
  if (amount <= 0n || !Number.isSafeInteger(bps) || bps <= 0) return null;
  return (amount * BigInt(bps) + 9_999n) / 10_000n;
}

export function coverBase(coverSkyt: number): bigint | null {
  if (!Number.isInteger(coverSkyt) || coverSkyt <= 0) return null;
  return BigInt(coverSkyt) * SKYT_BASE;
}

/** 1% of the cover, rounded up to the base unit. 50 → 0.50, 100 → 1.00, 250 → 2.50. */
export function protocolFeeBase(coverSkyt: number): bigint | null {
  const amount = coverBase(coverSkyt);
  if (amount == null) return null;
  return ceilBps(amount, 100);
}

export function premiumFromRate(coverSkyt: number, premiumRateBps: number): bigint | null {
  const amount = coverBase(coverSkyt);
  if (amount == null) return null;
  return ceilBps(amount, premiumRateBps);
}

export function premiumMapFromRate(premiumRateBps: number): PremiumByCover | null {
  const entries = COVER_SIZES.map((cover) => {
    const premium = premiumFromRate(cover, premiumRateBps);
    return premium == null ? null : ([cover, premium.toString()] as const);
  });
  if (entries.some((entry) => entry == null)) return null;
  return Object.fromEntries(entries as Array<readonly [CoverSize, string]>) as PremiumByCover;
}

export type Ticket = {
  premium: bigint;
  payout: bigint;
  maxLoss: bigint;
  maxGain: bigint;
  /** Percent × 10, rounded UP to 0.1. 240 means 24.0%. */
  breakEvenTenths: number;
  /** Truncated to 0.1. 41 means 4.1x. */
  multipleTenths: number;
};

/** premium and payout are base units. maxGain is payout − premium exactly. */
export function ticketFromBases(premium: bigint, payout: bigint): Ticket | null {
  if (premium <= 0n || payout <= 0n || payout < premium) return null;
  const breakEvenTenths = Number((premium * 1_000n + payout - 1n) / payout);
  const multipleTenths = Number((payout * 10n) / premium);
  if (!Number.isSafeInteger(breakEvenTenths) || !Number.isSafeInteger(multipleTenths)) return null;
  return {
    premium,
    payout,
    maxLoss: premium,
    maxGain: payout - premium,
    breakEvenTenths,
    multipleTenths,
  };
}

export function formatBase(base: bigint, decimals = 2): string {
  const negative = base < 0n;
  const value = negative ? -base : base;
  const whole = value / SKYT_BASE;
  const fraction = (value % SKYT_BASE).toString().padStart(6, "0").slice(0, decimals);
  const body = decimals > 0 ? `${whole}.${fraction}` : whole.toString();
  return negative ? `-${body}` : body;
}

export function formatTenths(tenths: number, suffix: string): string | null {
  if (!Number.isSafeInteger(tenths) || tenths < 0) return null;
  return `${Math.floor(tenths / 10)}.${tenths % 10}${suffix}`;
}

export function multipleLabel(tenths: number): string | null {
  return formatTenths(tenths, "x");
}

export function breakEvenLabel(tenths: number): string | null {
  const body = formatTenths(tenths, "");
  return body == null ? null : `${body}%`;
}

/** "20.0%" from basis points, truncated to 0.1 so a float never rounds the quote up. */
export function chanceLabel(chanceBps: number): string | null {
  if (!Number.isSafeInteger(chanceBps) || chanceBps < 0 || chanceBps > 10_000) return null;
  return formatTenths(Math.floor(chanceBps / 10), "%");
}

export function measureLabel(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  if (Number.isInteger(value)) return String(value);
  const tenths = Math.round(value * 10);
  return `${Math.trunc(tenths / 10)}.${Math.abs(tenths % 10)}`;
}

/**
 * Economics for one open rung at a cover size.
 * A modelled rung (no market address) returns null — its modelled premium is not a purchase ticket.
 */
export function rungEconomics(rung: RungQuote, cover: CoverSize): { premium: bigint; payout: bigint } | null {
  if (!rung.marketAddress) return null;
  const raw = rung.premiumBase[cover];
  const payout = coverBase(cover);
  if (!raw || !/^\d+$/.test(raw) || payout == null) return null;
  const premium = BigInt(raw);
  if (premium <= 0n) return null;
  return { premium, payout };
}

export function moneyParts(base: bigint): { sign: "-" | "+"; whole: string; fraction: string } {
  const sign = base < 0n ? "-" : "+";
  const value = base < 0n ? -base : base;
  const whole = (value / SKYT_BASE).toString();
  const fraction = (value % SKYT_BASE).toString().padStart(6, "0").slice(0, 2);
  return { sign, whole, fraction };
}

export function chipExceedsCap(cover: CoverSize, usedSkyt: number, capSkyt = MARKET_CAP_SKYT): boolean {
  if (!Number.isInteger(usedSkyt) || usedSkyt < 0) return false;
  return usedSkyt + cover > capSkyt;
}

/** Pixel heights. The larger of the two amounts is 40px. Integer ratio, then one decimal. */
export function payoffPixels(loss: bigint, gain: bigint): { loss: number; gain: number } {
  const larger = loss > gain ? loss : gain;
  if (larger <= 0n) return { loss: 0, gain: 0 };
  const px = (value: bigint) => Number((value * 400n) / larger) / 10;
  return { loss: px(loss), gain: px(gain) };
}
