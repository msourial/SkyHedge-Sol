import { expect } from "chai";
import { isValidImmutableMarketPricingTerms } from "../../shared/market-pricing";

describe("immutable market pricing gate", () => {
  it("does not treat station validation alone as pricing terms", () => {
    expect(isValidImmutableMarketPricingTerms(null)).to.equal(false);
    expect(isValidImmutableMarketPricingTerms(undefined)).to.equal(false);
  });

  it("accepts only a bounded probability, matching on-chain premium rate, and nonzero input commitment", () => {
    expect(isValidImmutableMarketPricingTerms({ probabilityBps: 2_000, premiumRateBps: 2_400, inputsHash: "ab".repeat(32) })).to.equal(true);
    expect(isValidImmutableMarketPricingTerms({ probabilityBps: 2_000, premiumRateBps: 2_401, inputsHash: "ab".repeat(32) })).to.equal(false);
    expect(isValidImmutableMarketPricingTerms({ probabilityBps: 9_001, premiumRateBps: 10_451, inputsHash: "ab".repeat(32) })).to.equal(false);
    expect(isValidImmutableMarketPricingTerms({ probabilityBps: 2_000, premiumRateBps: 2_400, inputsHash: "00".repeat(32) })).to.equal(false);
  });
});
