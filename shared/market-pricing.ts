export type ImmutableMarketPricingTerms = {
  probabilityBps: number;
  premiumRateBps: number;
  inputsHash: string;
};

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
