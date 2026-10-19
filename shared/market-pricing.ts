export type ImmutableMarketPricingTerms = {
  probabilityBps: number;
  premiumRateBps: number;
  inputsHash: string;
};

/** Same 1% protocol fee the quote engine adds on top of the committed premium rate. */
export const PROTOCOL_FEE_BPS = 100;

/** Ceil a base-unit amount by a basis-point rate. Same rounding as the on-chain premium. */
export function ceilRate(amount: bigint, bps: number): bigint {
  return (amount * BigInt(bps) + 9_999n) / 10_000n;
}

/**
 * Premium for an amount using terms already pinned on a Devnet market.
 * Returns null unless the probability, premium rate, and quote-inputs hash are a valid commitment.
 */
export function committedPremiumQuote(input: {
  protectedAmount: string;
  probabilityBps: number | null;
  premiumRateBps: number | null;
  inputsHash: string | null;
}): {
  probabilityBps: number;
  premiumRateBps: number;
  premium: string;
  protocolFee: string;
  protectedAmount: string;
  inputsHash: string;
  modelVersion: "noaa-rain-v1";
} | null {
  if (input.probabilityBps == null || input.premiumRateBps == null || !input.inputsHash) return null;
  if (!isValidImmutableMarketPricingTerms({ probabilityBps: input.probabilityBps, premiumRateBps: input.premiumRateBps, inputsHash: input.inputsHash })) return null;
  if (!/^\d+$/.test(input.protectedAmount) || BigInt(input.protectedAmount) <= 0n) return null;
  const amount = BigInt(input.protectedAmount);
  return {
    probabilityBps: input.probabilityBps,
    premiumRateBps: input.premiumRateBps,
    premium: ceilRate(amount, input.premiumRateBps).toString(),
    protocolFee: ceilRate(amount, PROTOCOL_FEE_BPS).toString(),
    protectedAmount: input.protectedAmount,
    inputsHash: input.inputsHash,
    modelVersion: "noaa-rain-v1",
  };
}

/** Shared client/server validation for quote terms that become immutable on-chain. */
export function isValidImmutableMarketPricingTerms(value: unknown): value is ImmutableMarketPricingTerms {
  if (!value || typeof value !== "object") return false;
  const terms = value as Partial<ImmutableMarketPricingTerms>;
  return Number.isInteger(terms.probabilityBps)
    && Number(terms.probabilityBps) >= 100
    && Number(terms.probabilityBps) <= 9_000
    && terms.premiumRateBps === Math.ceil((Number(terms.probabilityBps) * 11_500) / 10_000) + 100
    && typeof terms.inputsHash === "string"
    && /^[a-f0-9]{64}$/i.test(terms.inputsHash)
    && !/^0{64}$/i.test(terms.inputsHash);
}
