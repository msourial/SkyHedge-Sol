import { expect } from "chai";
import { initialSkytMintState } from "../../shared/mint-issuance";
import { desMoinesQuoteUnavailableReason, testerProtectionUnavailableReason } from "./tester-readiness";

const ready = {
  program: { executable: true },
  idl: { status: "ready" },
  protocol: { initialized: true },
  desMoinesMarket: { status: "ready", address: "Market111111111111111111111111111111111", vaultBalance: "2000000000", onchainStatus: JSON.stringify({ open: {} }), salesCloseAt: 2_000_000_000, thresholdMmX100: "5000", operator: "gte", quoteProbabilityBps: 2_000, premiumRateBps: 2_400, quoteInputsHash: "ab".repeat(32), evidenceStatus: "validated" },
  noaaEvidence: { status: "ready" },
};

describe("Devnet tester protection readiness", () => {
  it("allows the seeded open Des Moines market within the 500 SKYT cap", () => {
    expect(testerProtectionUnavailableReason(ready, ready.desMoinesMarket.address, "500000000")).to.equal(null);
  });

  it("rejects a missing NOAA package, unopened market, wrong market, and excess amount", () => {
    expect(testerProtectionUnavailableReason({ ...ready, desMoinesMarket: { ...ready.desMoinesMarket, evidenceStatus: "researching_evidence" } }, ready.desMoinesMarket.address, "1000000")).to.match(/NOAA/);
    expect(testerProtectionUnavailableReason({ ...ready, desMoinesMarket: { ...ready.desMoinesMarket, onchainStatus: JSON.stringify({ draft: {} }) } }, ready.desMoinesMarket.address, "1000000")).to.match(/open/);
    expect(testerProtectionUnavailableReason(ready, "Other1111111111111111111111111111111111", "1000000")).to.match(/Des Moines/);
    expect(testerProtectionUnavailableReason(ready, ready.desMoinesMarket.address, "500000001")).to.match(/500 SKYT/);
  });

  it("rejects a market whose immutable quote rate, probability, or evidence hash is invalid", () => {
    expect(testerProtectionUnavailableReason({ ...ready, desMoinesMarket: { ...ready.desMoinesMarket, premiumRateBps: 2_401 } }, ready.desMoinesMarket.address, "1000000")).to.match(/pricing terms/i);
    expect(testerProtectionUnavailableReason({ ...ready, desMoinesMarket: { ...ready.desMoinesMarket, quoteInputsHash: "00".repeat(32) } }, ready.desMoinesMarket.address, "1000000")).to.match(/pricing terms/i);
  });

  it("keeps a seeded market available when a later NOAA request is rate-limited", () => {
    expect(testerProtectionUnavailableReason({ ...ready, noaaEvidence: { status: "unavailable" } }, ready.desMoinesMarket.address, "1000000")).to.equal(null);
  });

  it("rejects a position after the immutable sales window closes", () => {
    const closed = { ...ready, desMoinesMarket: { ...ready.desMoinesMarket, salesCloseAt: 1_000 } };
    expect(testerProtectionUnavailableReason(closed, closed.desMoinesMarket.address, "1000000", 1_000)).to.match(/sales window/i);
  });

  it("accepts quotes only for the immutable on-chain observation window", () => {
    const window = { ...ready, desMoinesMarket: { ...ready.desMoinesMarket, salesCloseAt: 2_000_000_000, observationStart: 2_000_086_400, observationEnd: 2_000_691_200 } };
    expect(desMoinesQuoteUnavailableReason(window, "2033-05-19", "2033-05-26", 50, "gte", 1_999_999_999)).to.equal(null);
    expect(desMoinesQuoteUnavailableReason(window, "2033-05-18", "2033-05-26", 50, "gte", 1_999_999_999)).to.match(/immutable/i);
    expect(desMoinesQuoteUnavailableReason(window, "2033-05-19", "2033-05-26", 51, "gte", 1_999_999_999)).to.match(/threshold/i);
    expect(desMoinesQuoteUnavailableReason(window, "2033-05-19", "2033-05-26", 50, "lte", 1_999_999_999)).to.match(/direction/i);
  });
});

describe("initial Devnet SKYT issuance", () => {
  it("allows the initial allocation only when finalized mint supply is zero", () => {
    expect(initialSkytMintState("0")).to.equal("available");
    expect(initialSkytMintState("50000000000")).to.equal("already-issued");
    expect(initialSkytMintState("1")).to.equal("already-issued");
    expect(initialSkytMintState(undefined)).to.equal("checking");
    expect(initialSkytMintState("not-a-number")).to.equal("unavailable");
  });
});
