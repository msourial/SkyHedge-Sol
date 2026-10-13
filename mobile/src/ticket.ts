import { formatSkyt } from "./protection.ts";

/** Pure formatting + selection helpers for the v2 Protect ticket, Markets hero and Wallet. */

const BASE = 1_000_000n;
export const TESTER_CAP_BASE = 500_000_000n;

export type CoverageOption = { id: "50" | "100" | "250" | "max"; label: string; amountBase: string | null; enabled: boolean };

/** Coverage chips. Max = min(500 SKYT tester cap, finalized wallet balance), floored to whole SKYT. */
export function coverageOptions(walletSkytBase: string | null | undefined): CoverageOption[] {
  const balance = walletSkytBase && /^\d+$/.test(walletSkytBase) ? BigInt(walletSkytBase) : null;
  const fixed = (["50", "100", "250"] as const).map((id) => {
    const base = BigInt(id) * BASE;
    return { id, label: id, amountBase: base.toString(), enabled: true };
  });
  let maxBase: bigint | null = balance === null ? TESTER_CAP_BASE : balance < TESTER_CAP_BASE ? balance : TESTER_CAP_BASE;
  maxBase = (maxBase / BASE) * BASE;
  return [...fixed, { id: "max", label: "Max", amountBase: maxBase > 0n ? maxBase.toString() : null, enabled: maxBase > 0n }];
}

/** "31.7×" — payout divided by total premium, one decimal. */
export function returnMultiple(premiumBase: string | null | undefined, payoutBase: string | null | undefined): string | null {
  if (!premiumBase || !payoutBase || !/^\d+$/.test(premiumBase) || !/^\d+$/.test(payoutBase)) return null;
  const premium = BigInt(premiumBase);
  if (premium === 0n) return null;
  const tenths = (BigInt(payoutBase) * 10n) / premium;
  return `${tenths / 10n}.${tenths % 10n}×`;
}

/** Splits a total-charged premium into "net + fee" for the "Premium + 1% fee" row. */
export function premiumFeeLine(premiumBase: string, feeBase: string): string | null {
  if (!/^\d+$/.test(premiumBase) || !/^\d+$/.test(feeBase)) return null;
  const net = BigInt(premiumBase) - BigInt(feeBase);
  if (net < 0n) return null;
  return `${formatSkytFixed(net.toString(), 2)} + ${formatSkytFixed(feeBase, 2)}`;
}

/** Grouped SKYT with fixed decimals: "1,250.00". Truncates, never rounds up. */
export function formatSkytFixed(baseUnits: string | null | undefined, decimals = 2): string {
  if (!baseUnits || !/^\d+$/.test(baseUnits)) return "—";
  const value = BigInt(baseUnits);
  const whole = (value / BASE).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (decimals <= 0) return whole;
  const fraction = (value % BASE).toString().padStart(6, "0").slice(0, decimals);
  return `${whole}.${fraction}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Oct 6" in UTC (settlement windows are UTC). */
export function shortUtcDate(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds) return null;
  const d = new Date(unixSeconds * 1_000);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Pays out if Des Moines Intl Airport records ≥ 25 mm of rain between Oct 6 and Oct 19." */
export function triggerSentence(input: { station: string; thresholdMmX100: string | null | undefined; operator: string | null | undefined; start: number | null | undefined; end: number | null | undefined }): string | null {
  if (!input.thresholdMmX100 || !/^\d+$/.test(input.thresholdMmX100)) return null;
  const mm = trimMm(Number(input.thresholdMmX100) / 100);
  const symbol = input.operator === "gt" ? ">" : input.operator === "lt" ? "<" : input.operator === "lte" ? "≤" : "≥";
  const start = shortUtcDate(input.start);
  // Observation end is exclusive at 00:00 UTC; the last observed day is the day before.
  const end = shortUtcDate(input.end ? input.end - 1 : null);
  const window = start && end ? ` between ${start} and ${end}` : "";
  return `Pays out if ${input.station} records ${symbol} ${mm} mm of rain${window}.`;
}

export function trimMm(mm: number): string {
  return Number.isInteger(mm) ? String(mm) : mm.toFixed(1);
}

/** "Closes 1d 4h" / "Closes 3h 12m" / "Closes 9m" / "Sales closed". */
export function salesCountdown(salesCloseAt: number | null | undefined, nowSeconds: number): string | null {
  if (!salesCloseAt) return null;
  const left = salesCloseAt - nowSeconds;
  if (left <= 0) return "Sales closed";
  const d = Math.floor(left / 86_400), h = Math.floor((left % 86_400) / 3_600), m = Math.floor((left % 3_600) / 60);
  if (d > 0) return `Closes ${d}d ${h}h`;
  if (h > 0) return `Closes ${h}h ${m}m`;
  return `Closes ${Math.max(1, m)}m`;
}

/** "2.15" — premium per 100 SKYT covered, scaled from a real quote. */
export function premiumPer100(premiumBase: string | null | undefined, protectedBase: string | null | undefined): string | null {
  if (!premiumBase || !protectedBase || !/^\d+$/.test(premiumBase) || !/^\d+$/.test(protectedBase) || BigInt(protectedBase) === 0n) return null;
  const per100 = (BigInt(premiumBase) * 100n * BASE) / BigInt(protectedBase);
  return formatSkytFixed(per100.toString(), 2);
}

/** "DKA9…FD6y" */
export function shortAddress(address: string | null | undefined): string {
  if (!address) return "";
  return address.length <= 10 ? address : `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/** Inline balance check under the ticket. */
export function balanceCheck(walletSkytBase: string | null | undefined, premiumBase: string | null | undefined): "enough" | "short" | "unknown" {
  if (!walletSkytBase || !/^\d+$/.test(walletSkytBase) || !premiumBase || !/^\d+$/.test(premiumBase)) return "unknown";
  return BigInt(walletSkytBase) >= BigInt(premiumBase) ? "enough" : "short";
}

export { formatSkyt };

/** "Oct 14, 00:00 UTC" from unix seconds; null when unknown (never invented). */
export function utcDateTime(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) return null;
  const d = new Date(unixSeconds * 1_000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${hh}:${mm} UTC`;
}

export type PayState = { kind: "priced" | "pricing" | "error" | "blocked"; label: string };

/** What the "You pay" cell shows. Only a real quote premium ever produces a number. */
export function payState(input: { premiumBase: string | null | undefined; busy: boolean; error: string | null; live: boolean; salesClosed: boolean; walletConnected: boolean }): PayState {
  if (input.premiumBase && /^\d+$/.test(input.premiumBase)) return { kind: "priced", label: formatSkytFixed(input.premiumBase, 2) };
  if (input.busy) return { kind: "pricing", label: "Pricing…" };
  if (input.error) return { kind: "error", label: "Price unavailable" };
  if (!input.live) return { kind: "blocked", label: input.salesClosed ? "Sales closed" : "Not selling now" };
  if (!input.walletConnected) return { kind: "blocked", label: "Connect wallet" };
  return { kind: "blocked", label: "Not priced yet" };
}

/** Sticky buy button: "Protect for X SKYT" only with a real quote; otherwise disabled with the reason. */
export function buyCta(input: { premiumBase: string | null | undefined; busy: boolean; error: string | null; blockedReason: string | null; paymentReason: string | null }): { label: string; disabled: boolean; hint: string | null } {
  const priced = !!input.premiumBase && /^\d+$/.test(input.premiumBase);
  const label = priced ? `Protect for ${formatSkytFixed(input.premiumBase!, 2)} SKYT` : "Protect";
  if (input.blockedReason) return { label, disabled: true, hint: input.blockedReason };
  if (input.busy) return { label, disabled: true, hint: "Getting a live NOAA price…" };
  if (input.error) return { label, disabled: true, hint: "Price unavailable. Tap “Get a new price” above." };
  if (!priced) return { label, disabled: true, hint: "Waiting for a live price." };
  if (input.paymentReason) return { label, disabled: true, hint: input.paymentReason };
  return { label, disabled: false, hint: null };
}
