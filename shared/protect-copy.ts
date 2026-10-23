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
export const EXPLORER_LINK_LABEL = "View on Solana Explorer";
export const MARKETS_TITLE = "Where are your plans?";
export const MARKETS_SUB = "One official station per city. NOAA settles.";
export const MARKETS_FOOTER = "Rain only for now. Wind, snow and heat later.";
export const NOT_OPEN_YET = "Not open yet";
export const TORONTO_WAITING = "Waiting on Environment Canada data";
export const DEVNET_TAG = "Devnet";
export const COVERED_TITLE = "You're covered";
export const COVER_AMOUNT_TITLE = "Cover amount";
export const PRE_SIGN_TITLE = "You're about to sign";
export const PRE_SIGN_CTA = "Approve in your wallet.";
export const WALLET_DISCONNECTED = "Connect a wallet to see your SKYT and protections.";
export const WALLET_CONNECT = "Connect wallet";
export const WALLET_EMPTY = "No protections yet. Pick a city on Markets.";
export const WALLET_CHAIN_ERROR = "Can't read Devnet right now. Nothing is shown until it's back. Try again in a minute.";
export const TECHNICAL_DETAILS = "Technical details";
export const LANDING_HERO_TITLE = "Rain on your plans? Get paid.";
export const LANDING_HERO_LEAD = "Pick a city and a window. If NOAA's official gauge passes the trigger, the payout lands in your wallet.";
export const LANDING_HEADER_APP = "Open app";
export const LANDING_OPEN_APP = "Open the app";
export const LANDING_WAITLIST = "Join the waitlist";
export const LANDING_FINE = "Devnet only. Test SKYT, no real money.";
export const HOW_IT_WORKS = ["Pick a city.", "Choose your cover.", "Approve in your wallet."] as const;
export const HOW_IT_SETTLES_TITLE = "How it settles";
export const HOW_IT_SETTLES = "NOAA publishes final daily rain for the station. After the window closes, the program reads it. Over the trigger: paid out. Under: dry week. NOAA's final data alone decides payouts. WeatherXM is context only.";

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

export function protectButtonLabel(input: { connected: boolean; premiumLabel: string | null; triggerChosen: boolean; covered?: boolean }): { label: string; disabled: boolean; action: "connect" | "choose" | "protect" | "covered" } {
  if (input.covered) return { label: "Covered this window", disabled: true, action: "covered" };
  if (!input.connected) return { label: "Connect wallet to protect", disabled: true, action: "connect" };
  if (!input.triggerChosen || !input.premiumLabel) return { label: "Pick a trigger", disabled: true, action: "choose" };
  return { label: `Protect for ${input.premiumLabel} SKYT`, disabled: false, action: "protect" };
}

export type StakeSheetModel = {
  coverSkyt: number;
  premiumLabel: string;
  coverLabel: string;
  payLine: string;
  /** Sheet figure: "You get 100 SKYT". Slicker, figure-xl. */
  getLine: string;
  /** "If Central Park ≥ 69 mm by Nov 2". */
  conditionLine: string;
  /** Sticky ledger sentence under the pay line. */
  ledgerGetLine: string;
  /** "{chance} chance · {multiple} · {fee} SKYT fee included". */
  ledgerMeta: string;
  multiple: string;
  chance: string;
  /** Premium in SKYT base units. The protocol fee is already inside this amount. */
  payBase: string;
  feeLabel: string | null;
  feeLine: string | null;
  placeLine: string;
  triggerLine: string;
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
  /** Live quote protocol fee, only when that quote is for this cover amount. The fee is already inside the premium. */
  protocolFeeBase?: string | null;
  city?: string | null;
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
  const trigger = formatMm(input.triggerMm);
  const expiry = windowExpiryDay(input.windowLabel);
  const city = input.city?.trim() || null;
  const placeLine = city ? `${city} · ${input.station} · ${input.windowLabel}` : `${input.station} · ${input.windowLabel}`;
  const ledgerMeta = feeLabel
    ? `${deal.chance} chance · ${deal.multiple} · ${feeLabel} SKYT fee included`
    : `${deal.chance} chance · ${deal.multiple}`;
  return {
    coverSkyt: input.coverSkyt,
    premiumLabel: deal.payLabel,
    coverLabel: deal.getLabel,
    payLine: `You pay ${deal.payLabel} SKYT`,
    getLine: `You get ${deal.getLabel} SKYT`,
    conditionLine: `If ${input.station} ≥ ${trigger} mm by ${expiry}`,
    ledgerGetLine: `You get ${deal.getLabel} SKYT if ${input.station} hits ${trigger} mm by ${expiry}`,
    ledgerMeta,
    multiple: deal.multiple,
    chance: deal.chance,
    payBase: deal.payBase,
    feeLabel,
    feeLine: feeLabel ? `${feeLabel} SKYT fee, included in what you pay.` : null,
    placeLine,
    triggerLine: `Trigger ≥ ${trigger} mm`,
    preSign: PRE_SIGN_TITLE,
  };
}

/** "Balance 80.00 SKYT". Null when the chain read has no balance. */
export function balanceSkytLine(balanceLabel: string | null | undefined): string | null {
  const label = balanceLabel?.trim();
  if (!label) return null;
  return `Balance ${label} SKYT`;
}

/** Shown when the quoted premium is larger than the finalized SKYT balance. */
export function notEnoughSkyt(balanceLabel: string): string {
  return `Not enough SKYT. You have ${balanceLabel}.`;
}

export function coverExceedsBalance(premiumBase: string | null | undefined, balanceBase: string | null | undefined): boolean {
  if (!premiumBase || !balanceBase || !/^\d+$/.test(premiumBase) || !/^\d+$/.test(balanceBase)) return false;
  return BigInt(balanceBase) < BigInt(premiumBase);
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

export type ReceiptRow = { label: string; value: string; payout: boolean };

/** Gauge receipt rows. Observed millimetres and the opened time are omitted unless the position actually has them. */
export function coveredReceiptRows(input: {
  premiumPaid: string | null | undefined;
  coverAmount: string | null | undefined;
  trigger: string | null | undefined;
  windowLabel?: string | null | undefined;
  observedMm?: number | null;
  windowStart?: string | null;
  openedAt?: string | null;
}): ReceiptRow[] {
  const paid = formatQuoteSkyt(input.premiumPaid ?? null, 2);
  const cover = formatQuoteSkyt(input.coverAmount ?? null, 0);
  const trigger = triggerMillimetres(input.trigger);
  const pays = cover && trigger != null ? `${cover} SKYT if ≥ ${formatMm(trigger)} mm` : "—";
  const rows: ReceiptRow[] = [
    { label: "Cover", value: cover ? `${cover} SKYT` : "—", payout: false },
    { label: "Paid", value: paid ? `${paid} SKYT` : "—", payout: false },
    { label: "Pays", value: pays, payout: true },
  ];
  if (input.observedMm != null && Number.isFinite(input.observedMm)) {
    rows.push({ label: "So far", value: `${formatMm(input.observedMm)} mm`, payout: false });
  } else if (input.windowStart?.trim()) {
    rows.push({ label: "Counting starts", value: stripUtc(input.windowStart) ?? input.windowStart.trim(), payout: false });
  }
  if (input.openedAt?.trim()) rows.push({ label: "Opened", value: input.openedAt.trim(), payout: false });
  return rows;
}

export function coveredPlaceLine(input: { city: string | null | undefined; station: string | null | undefined; windowLabel: string | null | undefined }): string | null {
  const parts = [input.city, input.station, input.windowLabel].map((part) => part?.trim()).filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(" · ") : null;
}

export type WindowStamp = { tone: "paid" | "dry"; title: string; subline: string };

/**
 * Stamp once the window has closed. Paid out is slicker. Dry week (or Dry month) is --dry-text.
 * A dry stamp needs both the observed total and the trigger. Nothing here invents either.
 */
export function windowStamp(input: {
  closed: boolean;
  paidOut: boolean;
  payoutLabel: string | null | undefined;
  observedMm: number | null | undefined;
  triggerMm: number | null | undefined;
  monthly: boolean;
}): WindowStamp | null {
  if (!input.closed) return null;
  if (input.paidOut) {
    const payout = input.payoutLabel?.replace(/\s*SKYT\s*$/i, "").trim();
    if (!payout) return null;
    return { tone: "paid", title: `Paid out · ${payout} SKYT`, subline: "It rained. You're paid." };
  }
  if (input.observedMm == null || input.triggerMm == null || !Number.isFinite(input.observedMm) || !Number.isFinite(input.triggerMm)) return null;
  const name = input.monthly ? "Dry month" : "Dry week";
  return {
    tone: "dry",
    title: `${name} · ${formatMm(input.observedMm)} of ${formatMm(input.triggerMm)} mm`,
    subline: "No payout. Your plans stayed dry.",
  };
}

/** <15% Probably dry. 15–35% Bring a jacket, maybe. >35% Umbrella week. */
export function forecasterBand(chancePercent: number): "Probably dry." | "Bring a jacket, maybe." | "Umbrella week." | null {
  if (!Number.isFinite(chancePercent) || chancePercent < 0 || chancePercent > 100) return null;
  if (chancePercent < 15) return "Probably dry.";
  if (chancePercent <= 35) return "Bring a jacket, maybe.";
  return "Umbrella week.";
}

export function forecasterCopy(input: { probabilityBps: number | null | undefined; station: string | null | undefined; triggerMm: number | null | undefined }): { band: string; detail: string } | null {
  if (input.probabilityBps == null || !Number.isSafeInteger(input.probabilityBps)) return null;
  const chance = chanceLabel(input.probabilityBps);
  const band = forecasterBand(input.probabilityBps / 100);
  const station = input.station?.trim();
  if (!chance || !band || !station || input.triggerMm == null || !Number.isFinite(input.triggerMm)) return null;
  return { band, detail: `${chance} chance ${station} clears ${formatMm(input.triggerMm)} mm.` };
}

export type MarketRowModel = {
  stationLine: string;
  figures: string | null;
  status: string;
  ink: "glacier" | "dry";
  forecaster: { band: string; detail: string } | null;
};

/** Open rows carry the quote. Unopened rows name the station and a dry status. Toronto waits on Environment Canada. */
export function marketRowModel(input: {
  slug: string;
  stationSource: string | null | undefined;
  open: boolean;
  closed?: boolean;
  tenor: "weekly" | "monthly" | null;
  expiry: string | null | undefined;
  triggerMm: number | null;
  multiple: string | null;
  probabilityBps: number | null;
}): MarketRowModel {
  const station = stationDisplayName(input.stationSource) ?? "Station";
  if (input.slug === "toronto") {
    return { stationLine: station, figures: null, status: TORONTO_WAITING, ink: "dry", forecaster: null };
  }
  const expiry = stripUtc(input.expiry);
  if (input.open && input.triggerMm != null && input.multiple && expiry) {
    const tenor = input.tenor === "monthly" ? "monthly" : "weekly";
    return {
      stationLine: `${station} · ${tenor} to ${expiry}`,
      figures: `≥${formatMm(input.triggerMm)} mm  ${input.multiple}`,
      status: "Open",
      ink: "glacier",
      forecaster: forecasterCopy({ probabilityBps: input.probabilityBps, station, triggerMm: input.triggerMm }),
    };
  }
  return { stationLine: station, figures: null, status: input.closed ? "Closed" : NOT_OPEN_YET, ink: "dry", forecaster: null };
}

export function productStatusLabel(tone: "open" | "opens" | "closed" | "live" | "soon"): { text: string; ink: "glacier" | "dry" } {
  if (tone === "open" || tone === "live") return { text: "Open", ink: "glacier" };
  if (tone === "closed") return { text: "Closed", ink: "dry" };
  return { text: NOT_OPEN_YET, ink: "dry" };
}

export function protectHeader(input: { station: string | null | undefined; windowStart: string | null | undefined; windowEnd: string | null | undefined }): { stationLine: string; settleLine: string } {
  const station = (stationDisplayName(input.station) ?? input.station?.trim() ?? "Station").replace(/\s+station$/i, "");
  const start = stripUtc(input.windowStart);
  const end = stripUtc(input.windowEnd);
  return {
    stationLine: start && end ? `${station} station · ${start} – ${end}` : `${station} station`,
    settleLine: end ? `NOAA's final daily totals settle it after ${end} (UTC).` : "NOAA's final daily totals settle it after the window closes (UTC).",
  };
}

/** Empty until the window, or the observed total when a real reading exists. */
export function gaugeStateLine(input: { observedMm: number | null | undefined; updated: string | null | undefined; windowStart: string | null | undefined }): string {
  if (input.observedMm != null && Number.isFinite(input.observedMm)) {
    const mm = formatMm(input.observedMm);
    return input.updated?.trim() ? `So far ${mm} mm · updated ${input.updated.trim()}` : `So far ${mm} mm`;
  }
  const start = stripUtc(input.windowStart);
  return start ? `Counting starts ${start}` : "Counting starts when the window opens";
}

export function moreTriggersSoon(count: number): string | null {
  if (!Number.isInteger(count) || count <= 0) return null;
  return `${count} more triggers soon`;
}

/** Labels only for priced rungs and the top of the tube. The rest stay unlabelled ticks. */
export function gaugeMarkPlan(rungs: readonly { mm: number; priced: boolean }[], selectedMm: number | null): Array<{ mm: number; labelled: boolean; selected: boolean }> {
  if (!rungs.length) return [];
  const max = Math.max(...rungs.map((rung) => rung.mm));
  return [...rungs].sort((left, right) => left.mm - right.mm).map((rung) => ({
    mm: rung.mm,
    labelled: rung.priced || rung.mm === max,
    selected: selectedMm != null && rung.mm === selectedMm,
  }));
}

export function activeProtectionLine(input: { city: string | null | undefined; triggerMm: number | null; expiry: string | null | undefined; payoutLabel: string | null | undefined }): { title: string; payout: string } | null {
  const city = input.city?.trim();
  const expiry = stripUtc(input.expiry);
  const payout = input.payoutLabel?.trim();
  if (!city || input.triggerMm == null || !Number.isFinite(input.triggerMm) || !expiry || !payout) return null;
  return { title: `${city} · ≥${formatMm(input.triggerMm)} mm · ends ${expiry}`, payout: `${payout.replace(/\s*SKYT\s*$/i, "")} SKYT` };
}

/**
 * Tube fill as a fraction of max. Empty when there is no observed reading.
 * Paid out with no reading may sit just above the trigger. It never invents millimetres.
 */
export function gaugeWaterLevel(input: { observedMm?: number | null; maxMm: number; triggerMm?: number | null; paidOut?: boolean }): number {
  const max = input.maxMm;
  if (!Number.isFinite(max) || max <= 0) return 0;
  if (input.observedMm != null && Number.isFinite(input.observedMm) && input.observedMm >= 0) {
    return Math.min(1, input.observedMm / max);
  }
  if (input.paidOut && input.triggerMm != null && Number.isFinite(input.triggerMm) && input.triggerMm > 0 && input.triggerMm < max) {
    const above = input.triggerMm + (max - input.triggerMm) * 0.4;
    return Math.min(1, above / max);
  }
  return 0;
}

function formatMm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function stripUtc(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\s*\(UTC\)\s*/gi, " ").replace(/\s+/g, " ").trim();
  return trimmed || null;
}

function windowExpiryDay(windowLabel: string): string {
  const end = windowLabel.split(" – ")[1] ?? windowLabel;
  return stripUtc(end) ?? end.trim();
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
