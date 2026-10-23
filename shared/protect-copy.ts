/**
 * Customer copy for the stake sheet, Protect button, ladder, and market status.
 * Every figure is passed in from a quote or a market. Nothing here invents a price.
 */
import { committedPremiumQuote } from "./market-pricing.ts";
import { payGet } from "./pay-get.ts";
import { chanceLabel } from "./window-chain.ts";

const BASE = 1_000_000n;
export const COVER_CHIPS = [50, 100, 250] as const;
export type CoverChip = (typeof COVER_CHIPS)[number];
export const ONE_PROTECTION_NOTE = "One protection per wallet per window.";
export const EXPLORER_LINK_LABEL = "View on Solana Explorer (devnet)";

export function coverBaseUnits(coverSkyt: number): string | null {
  if (!Number.isInteger(coverSkyt) || coverSkyt <= 0) return null;
  return (BigInt(coverSkyt) * BASE).toString();
}

/** Truncated SKYT from base units. Null unless the quote actually provided digits. */
export function formatQuoteSkyt(base: string | null | undefined, decimals = 2): string | null {
  if (!base || !/^\d+$/.test(base)) return null;
  const value = BigInt(base);
  const whole = (value / BASE).toString();
  if (decimals <= 0) return whole;
  const fraction = (value % BASE).toString().padStart(6, "0").slice(0, decimals);
  return `${whole}.${fraction}`;
}

/** Display name carried on the city record, without the NOAA prefix. */
export function stationDisplayName(source: string | null | undefined): string | null {
  if (!source) return null;
  const name = source.replace(/^NOAA\s+/i, "").trim();
  return name || null;
}

export function protectButtonLabel(input: { connected: boolean; premiumLabel: string | null; triggerChosen: boolean }): { label: string; disabled: boolean; action: "connect" | "choose" | "protect" } {
  if (!input.connected) return { label: "Connect wallet to protect", disabled: true, action: "connect" };
  if (!input.triggerChosen || !input.premiumLabel) return { label: "Pick a trigger", disabled: true, action: "choose" };
  return { label: `Protect for ${input.premiumLabel} SKYT`, disabled: false, action: "protect" };
}

export type StakeSheetModel = {
  coverSkyt: number;
  premiumLabel: string;
  coverLabel: string;
  payLine: string;
  getLine: string;
  multiple: string;
  feeLine: string | null;
  preSign: string;
};

/**
 * Stake sheet for one cover chip. Premium and multiple come from the priced rate.
 * The protocol fee is the quote's protocolFee field (a live quote, or the committed quote for that amount).
 */
export function stakeSheetForCover(input: {
  coverSkyt: number;
  probabilityBps: number | null;
  premiumRateBps: number | null;
  inputsHash: string | null;
  /** Live quote protocol fee, only when that quote is for this cover amount. */
  protocolFeeBase?: string | null;
  station: string | null;
  triggerMm: number | null;
  windowLabel: string | null;
}): StakeSheetModel | null {
  if (input.premiumRateBps == null || input.probabilityBps == null) return null;
  if (!input.station || input.triggerMm == null || !Number.isFinite(input.triggerMm) || !input.windowLabel) return null;
  const deal = payGet({ coverageSkyt: input.coverSkyt, premiumRateBps: input.premiumRateBps, probabilityBps: input.probabilityBps });
  if (!deal) return null;
  const protectedAmount = coverBaseUnits(input.coverSkyt);
  const committed = protectedAmount
    ? committedPremiumQuote({ protectedAmount, probabilityBps: input.probabilityBps, premiumRateBps: input.premiumRateBps, inputsHash: input.inputsHash })
    : null;
  const feeBase = input.protocolFeeBase && /^\d+$/.test(input.protocolFeeBase) ? input.protocolFeeBase : committed?.protocolFee ?? null;
  const feeLabel = formatQuoteSkyt(feeBase, 2);
  const trigger = Number.isInteger(input.triggerMm) ? String(input.triggerMm) : input.triggerMm.toFixed(1);
  return {
    coverSkyt: input.coverSkyt,
    premiumLabel: deal.payLabel,
    coverLabel: deal.getLabel,
    payLine: `You pay ${deal.payLabel} SKYT`,
    getLine: `You get ${deal.getLabel} SKYT if ${input.station} hits ≥ ${trigger} mm, ${input.windowLabel}`,
    multiple: deal.multiple,
    feeLine: feeLabel ? `Includes ${feeLabel} SKYT protocol fee` : null,
    preSign: `You'll sign: pay ${deal.payLabel} SKYT · cover ${deal.getLabel} SKYT · ${input.station} ≥ ${trigger} mm · ${input.windowLabel}`,
  };
}

export type LadderTickState = "priced" | "soon" | "selected";

export function ladderTicks<T extends { thresholdMm: number; onChain: boolean; probabilityBps: number }>(
  rows: readonly T[],
  selectedMm: number | null,
): Array<{ thresholdMm: number; label: string; tappable: boolean; state: LadderTickState }> {
  return rows.map((row) => {
    const chance = row.onChain ? chanceLabel(row.probabilityBps) : null;
    if (!row.onChain || !chance) {
      return { thresholdMm: row.thresholdMm, label: `≥ ${row.thresholdMm} mm · soon`, tappable: false, state: "soon" as const };
    }
    const selected = row.thresholdMm === selectedMm;
    return {
      thresholdMm: row.thresholdMm,
      label: `≥ ${row.thresholdMm} mm · ${chance}`,
      tappable: true,
      state: selected ? "selected" as const : "priced" as const,
    };
  });
}

export type StatusInk = "glacier" | "neutral" | "muted";

/** One status system. Glacier for Open, neutral for a real Opens date, muted for Closed. Never green. */
export function marketStatusInk(tone: "open" | "opens" | "closed"): StatusInk {
  if (tone === "open") return "glacier";
  if (tone === "opens") return "neutral";
  return "muted";
}

export function coveredReceiptRows(input: { premiumPaid: string | null | undefined; coverAmount: string | null | undefined; trigger: string | null | undefined; windowLabel: string | null | undefined }): Array<{ label: "Paid" | "Cover" | "Trigger" | "Window"; value: string; payout: boolean }> {
  const paid = formatQuoteSkyt(input.premiumPaid ?? null, 2);
  const cover = formatQuoteSkyt(input.coverAmount ?? null, 0);
  return [
    { label: "Paid", value: paid ? `${paid} SKYT` : "—", payout: false },
    { label: "Cover", value: cover ? `${cover} SKYT` : "—", payout: true },
    { label: "Trigger", value: input.trigger?.trim() || "—", payout: true },
    { label: "Window", value: input.windowLabel?.trim() || "—", payout: false },
  ];
}

export function triggerMillimetres(label: string | null | undefined): number | null {
  if (!label) return null;
  const match = /(\d+(?:\.\d+)?)/.exec(label);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function devnetExplorerUrl(input: { signature?: string | null; address?: string | null }): string | null {
  if (input.signature && /^[1-9A-HJ-NP-Za-km-z]+$/.test(input.signature)) return `https://explorer.solana.com/tx/${encodeURIComponent(input.signature)}?cluster=devnet`;
  if (input.address && /^[1-9A-HJ-NP-Za-km-z]+$/.test(input.address)) return `https://explorer.solana.com/address/${encodeURIComponent(input.address)}?cluster=devnet`;
  return null;
}
