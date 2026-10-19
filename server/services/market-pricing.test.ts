import { expect } from "chai";
import { committedPremiumQuote, isValidImmutableMarketPricingTerms } from "../../shared/market-pricing";

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

  it("prices 100 SKYT from the committed premium rate without a fresh NOAA quote", () => {
    const hash = "fb".repeat(32);
    expect(committedPremiumQuote({ protectedAmount: "100000000", probabilityBps: 2_000, premiumRateBps: 2_400, inputsHash: hash })).to.deep.equal({
      probabilityBps: 2_000, premiumRateBps: 2_400, premium: "24000000", protocolFee: "1000000",
      protectedAmount: "100000000", inputsHash: hash, modelVersion: "noaa-rain-v1",
    });
    expect(committedPremiumQuote({ protectedAmount: "100000000", probabilityBps: 2_000, premiumRateBps: 2_401, inputsHash: hash })).to.equal(null);
  });
});
