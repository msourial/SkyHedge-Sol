export const DES_MOINES_SEED_LIQUIDITY_BASE = 2_000_000_000n;

/** Serialized Anchor account field offsets. Keep these aligned with ProtocolConfig and Market in the Anchor program. */
export const PROTOCOL_CONFIG_LAYOUT = {
  admin: 8,
  collateralMint: 136,
  tokenProgram: 168,
  nextMarketId: 200,
  minimumLength: 208,
} as const;

export const MARKET_ACCOUNT_LAYOUT = {
  marketId: 8,
  protocol: 16,
  cityHash: 80,
  stationIdHash: 112,
  providerHash: 144,
  methodologyHash: 176,
  quoteInputsHash: 208,
  salesCloseAt: 249,
  observationStart: 257,
  observationEnd: 265,
  probabilityBps: 289,
  premiumRateBps: 291,
  totalShares: 317,
  accountingValues: [325, 333, 341, 349, 357, 365, 373],
  status: 381,
  result: 382,
  bump: 383,
  minimumLength: 384,
} as const;

export type SeedStep = "create" | "fund" | "open";
export type SeedMarketState = "missing" | "draft" | "open" | "locked" | "awaiting_settlement" | "settled" | "data_unavailable" | "closed" | "cancelled" | "unknown";

/** Anchor/Borsh enum byte for MarketStatus in the committed Market account layout. */
export function marketStateFromAccountData(data: Uint8Array): SeedMarketState | null {
  if (data.length < MARKET_ACCOUNT_LAYOUT.minimumLength) return null;
  return (["draft", "open", "locked", "awaiting_settlement", "settled", "data_unavailable", "closed", "cancelled"] as const)[data[MARKET_ACCOUNT_LAYOUT.status]] ?? null;
}

/** A cancelled seed candidate must be a pristine Draft: no lifecycle result, shares, or accounting liabilities. */
export function isEmptyDraftMarketAccountData(data: Uint8Array): boolean {
  if (data.length < MARKET_ACCOUNT_LAYOUT.minimumLength
    || data[MARKET_ACCOUNT_LAYOUT.status] !== 0
    || data[MARKET_ACCOUNT_LAYOUT.result] !== 0) return false;
  return [MARKET_ACCOUNT_LAYOUT.totalShares, ...MARKET_ACCOUNT_LAYOUT.accountingValues]
    .every((offset) => data.subarray(offset, offset + 8).every((byte) => byte === 0));
}

/** Decode the JSON enum shape emitted by Anchor's account coder/status API. */
export function marketStateFromStatusJson(value: string | null): SeedMarketState | null {
  try {
    const parsed = JSON.parse(value ?? "null") as Record<string, unknown> | null;
    const key = parsed && typeof parsed === "object" ? Object.keys(parsed)[0]?.toLowerCase() : "";
    if (key === "awaitingsettlement") return "awaiting_settlement";
    if (key === "dataunavailable") return "data_unavailable";
    if (key === "draft" || key === "open" || key === "locked" || key === "settled" || key === "closed" || key === "cancelled") return key;
    return null;
  } catch { return null; }
}

export type SeedMarketProgress = {
  state: SeedMarketState;
  salesCloseAt: number | null;
  observationStart: number | null;
  observationEnd: number | null;
  quoteProbabilityBps: number | null;
  premiumRateBps: number | null;
  quoteInputsHash: string | null;
  totalShares: string | null;
};

export type SeedPricingTerms = {
  salesCloseAt: number;
  observationStart: number;
  observationEnd: number;
  probabilityBps: number;
  premiumRateBps: number;
  inputsHash: string;
};

/** V1 Devnet seed markets open sales for 24 hours, then observe five full UTC days. */
export function isValidDesMoinesSeedSchedule(schedule: {
  salesCloseAt: number | null;
  observationStart: number | null;
  observationEnd: number | null;
}): boolean {
  const { salesCloseAt, observationStart, observationEnd } = schedule;
  const day = 86_400;
  return Number.isSafeInteger(salesCloseAt) && Number.isSafeInteger(observationStart) && Number.isSafeInteger(observationEnd)
    && salesCloseAt! > 0
    && observationStart === Math.ceil(salesCloseAt! / day) * day
    && observationEnd! - observationStart! === 5 * day;
}

/** A live NOAA package may refresh the 24-hour close time; resume only when the immutable observation dates and quote commitment still match. */
export function seedTermsMatch(market: SeedMarketProgress, pricing: SeedPricingTerms): boolean {
  return market.observationStart === pricing.observationStart
    && market.observationEnd === pricing.observationEnd
    && market.quoteProbabilityBps === pricing.probabilityBps
    && market.premiumRateBps === pricing.premiumRateBps
    && market.quoteInputsHash?.toLowerCase() === pricing.inputsHash.toLowerCase();
}

export type SeedActionMode = "fresh" | "resume" | "open" | "in_progress" | "unavailable";

/** Keep the Builder's enabled action in sync with the finalized market lifecycle. */
export function desMoinesSeedActionMode(input: {
  protocolReady: boolean;
  marketReadStatus: string;
  marketState: SeedMarketState;
  salesCloseAt: number | null;
  evidenceReady: boolean;
  committedTermsReady: boolean;
  pricingReady: boolean;
  nowSeconds: number;
}): SeedActionMode {
  if (!input.protocolReady) return "unavailable";
  if (input.marketState === "open") return "open";
  if (input.marketState === "locked" || input.marketState === "awaiting_settlement") return "in_progress";
  if (input.marketState === "draft") {
    if (input.salesCloseAt === null) return "unavailable";
    if (input.salesCloseAt > input.nowSeconds) {
      return input.evidenceReady && input.committedTermsReady ? "resume" : "unavailable";
    }
    return "unavailable";
  }
  if (input.marketState === "settled" || input.marketState === "data_unavailable" || input.marketState === "closed" || input.marketState === "cancelled") {
    return input.marketReadStatus === "ready" && input.pricingReady ? "fresh" : "unavailable";
  }
  if (input.marketState === "missing") {
    return input.marketReadStatus === "pending" && input.pricingReady ? "fresh" : "unavailable";
  }
  return "unavailable";
}

export function assertFreshSeedAllowed(input: {
  marketFound: boolean;
  marketReadStatus: string;
  protocolStatus: string;
  protocolInitialized: boolean;
}): void {
  if (input.marketFound) return;
  if (input.marketReadStatus !== "pending" || input.protocolStatus !== "ready" || !input.protocolInitialized) {
    throw new Error("Finalized Devnet did not confirm that Des Moines is absent; market creation is locked until the protocol and market scan are ready.");
  }
}

export function assertFreshMarketCounterMatches(reportedNextMarketId: string | null, finalizedNextMarketId: bigint): void {
  if (!reportedNextMarketId || !/^\d+$/.test(reportedNextMarketId) || BigInt(reportedNextMarketId) !== finalizedNextMarketId) {
    throw new Error("Finalized Devnet changed after the market scan. Refresh Builder status and prepare the seed again.");
  }
}

export type SeedPlan = {
  steps: SeedStep[];
  additionalFundingBase: bigint;
  alreadyOpen: boolean;
};

/** Derive only missing seed approvals from a fresh finalized market/vault read. */
export function planDesMoinesSeed(
  market: SeedMarketProgress,
  pricing: SeedPricingTerms,
  nowSeconds: number,
): SeedPlan {
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < 0) throw new Error("Current time is invalid.");
  const fresh = (): SeedPlan => ({ steps: ["create", "fund", "open"], additionalFundingBase: DES_MOINES_SEED_LIQUIDITY_BASE, alreadyOpen: false });
  const expiredDraft = market.state === "draft" && market.salesCloseAt !== null && market.salesCloseAt <= nowSeconds;
  const terminal = ["settled", "data_unavailable", "closed", "cancelled"].includes(market.state);

  if (expiredDraft) throw new Error("The expired Draft must be explicitly cancelled before a fresh market ID can be created.");
  if (market.state === "missing" || terminal) return fresh();
  if (market.state === "open") return { steps: [], additionalFundingBase: 0n, alreadyOpen: true };
  if (market.state !== "draft") throw new Error("A Des Moines market is in progress. Only a fresh finalized Draft can be resumed by this Builder flow.");

  const termsMatch = seedTermsMatch(market, pricing);
  if (!termsMatch) throw new Error("The finalized Draft has different immutable NOAA pricing terms. It will not be reused or silently replaced before expiry.");

  const balance = BigInt(market.totalShares ?? "0");
  if (balance < 0n) throw new Error("The finalized market vault balance is invalid.");
  const additionalFundingBase = balance < DES_MOINES_SEED_LIQUIDITY_BASE
    ? DES_MOINES_SEED_LIQUIDITY_BASE - balance
    : 0n;
  return {
    steps: [...(additionalFundingBase > 0n ? ["fund" as const] : []), "open"],
    additionalFundingBase,
    alreadyOpen: false,
  };
}
