import { expect } from "chai";
import { assertFreshMarketCounterMatches, assertFreshSeedAllowed, DES_MOINES_SEED_LIQUIDITY_BASE, desMoinesSeedActionMode, isEmptyDraftMarketAccountData, isValidDesMoinesSeedSchedule, MARKET_ACCOUNT_LAYOUT, marketStateFromAccountData, marketStateFromStatusJson, nextDesMoinesBuilderMilestone, planDesMoinesSeed, seedTermsMatch, type SeedMarketProgress, type SeedPricingTerms } from "../../shared/des-moines-seed-plan";

const pricing: SeedPricingTerms = {
  salesCloseAt: 2_000_000_000,
  observationStart: 2_000_073_600,
  observationEnd: 2_000_505_600,
  probabilityBps: 2_000,
  premiumRateBps: 2_400,
  inputsHash: "ab".repeat(32),
};

const missing: SeedMarketProgress = {
  state: "missing", salesCloseAt: null, observationStart: null, observationEnd: null,
  quoteProbabilityBps: null, premiumRateBps: null, quoteInputsHash: null, totalShares: null,
};

const draft: SeedMarketProgress = {
  state: "draft", salesCloseAt: pricing.salesCloseAt,
  observationStart: pricing.observationStart, observationEnd: pricing.observationEnd,
  quoteProbabilityBps: pricing.probabilityBps, premiumRateBps: pricing.premiumRateBps,
  quoteInputsHash: pricing.inputsHash, totalShares: "0",
};

describe("Des Moines seed recovery plan", () => {
  it("describes the next Builder proof from finalized market state", () => {
    const shared = { protocolReady: true, skytMintReady: true, marketReadStatus: "ready" as const, marketAddress: "Market0", marketId: "0", pricingReady: true, emptyDraftCancellationReady: true, nowSeconds: 10_000 };
    expect(nextDesMoinesBuilderMilestone({ ...shared, marketState: "draft", vaultBalanceBase: "0", salesCloseAt: 9_999 }))
      .to.match(/expired Draft with zero vault collateral.*confirm it has no shares or liabilities and cancel/i);
    expect(nextDesMoinesBuilderMilestone({ ...shared, emptyDraftCancellationReady: false, marketState: "draft", vaultBalanceBase: "0", salesCloseAt: 9_999 }))
      .to.match(/expired Draft with zero vault collateral.*cancellation is not verified.*do not create another market/i);
    expect(nextDesMoinesBuilderMilestone({ ...shared, marketState: "draft", vaultBalanceBase: "2000000000", salesCloseAt: 11_000 }))
      .to.match(/funded but remains a Draft.*approve opening/i);
    expect(nextDesMoinesBuilderMilestone({ ...shared, marketState: "open", vaultBalanceBase: "2000000000", salesCloseAt: 9_000 }))
      .to.match(/open and funded.*final NOAA observation/i);
    expect(nextDesMoinesBuilderMilestone({ ...shared, marketState: "open", vaultBalanceBase: "0", salesCloseAt: 9_000 }))
      .to.match(/Open, but its finalized vault has no collateral.*unavailable/i);
    expect(nextDesMoinesBuilderMilestone({ ...shared, marketState: "cancelled", vaultBalanceBase: "0", salesCloseAt: 9_000 }))
      .to.match(/cancelled.*current next market ID.*fresh exact-window NOAA pricing terms/i);
    expect(nextDesMoinesBuilderMilestone({ ...shared, marketReadStatus: "pending", marketState: "open", vaultBalanceBase: "2000000000", salesCloseAt: 9_000 }))
      .to.match(/market read is unavailable.*no seed or protection readiness/i);
    expect(nextDesMoinesBuilderMilestone({ ...shared, marketState: "missing", marketAddress: null, marketId: null, vaultBalanceBase: null, salesCloseAt: null }))
      .to.match(/create, fund, and open.*exact-window NOAA pricing terms/i);
  });

  it("enables only justified fresh, resume, and no-op Builder actions", () => {
    const base = { protocolReady: true, marketReadStatus: "ready", salesCloseAt: 2_000, evidenceReady: true, committedTermsReady: true, pricingReady: true, nowSeconds: 1_000 };
    expect(desMoinesSeedActionMode({ ...base, marketState: "draft" })).to.equal("resume");
    expect(desMoinesSeedActionMode({ ...base, marketState: "draft", salesCloseAt: 1_000 })).to.equal("unavailable");
    expect(desMoinesSeedActionMode({ ...base, marketState: "open" })).to.equal("open");
    expect(desMoinesSeedActionMode({ ...base, marketState: "settled" })).to.equal("fresh");
    expect(desMoinesSeedActionMode({ ...base, marketState: "cancelled" })).to.equal("fresh");
    expect(desMoinesSeedActionMode({ ...base, marketReadStatus: "pending", marketState: "missing" })).to.equal("fresh");
  });

  it("blocks malformed, unknown, and evidence-incomplete market states in the Builder", () => {
    const base = { protocolReady: true, marketReadStatus: "ready", salesCloseAt: 2_000, evidenceReady: true, committedTermsReady: true, pricingReady: true, nowSeconds: 1_000 };
    expect(desMoinesSeedActionMode({ ...base, marketState: "unknown" })).to.equal("unavailable");
    expect(desMoinesSeedActionMode({ ...base, marketState: "draft", committedTermsReady: false })).to.equal("unavailable");
    expect(desMoinesSeedActionMode({ ...base, marketState: "draft", evidenceReady: false })).to.equal("unavailable");
    expect(desMoinesSeedActionMode({ ...base, marketState: "draft", salesCloseAt: null })).to.equal("unavailable");
    expect(desMoinesSeedActionMode({ ...base, marketState: "missing" })).to.equal("unavailable");
  });

  it("allows a new market only after a ready protocol and a finalized full-scan absence", () => {
    expect(() => assertFreshSeedAllowed({ marketFound: false, marketReadStatus: "pending", protocolStatus: "ready", protocolInitialized: true })).not.to.throw();
    expect(() => assertFreshSeedAllowed({ marketFound: false, marketReadStatus: "unavailable", protocolStatus: "ready", protocolInitialized: true })).to.throw(/did not confirm/);
    expect(() => assertFreshSeedAllowed({ marketFound: false, marketReadStatus: "error", protocolStatus: "ready", protocolInitialized: true })).to.throw(/did not confirm/);
    expect(() => assertFreshSeedAllowed({ marketFound: false, marketReadStatus: "pending", protocolStatus: "pending", protocolInitialized: false })).to.throw(/did not confirm/);
  });

  it("rejects a stale market scan if the finalized next-market counter changed", () => {
    expect(() => assertFreshMarketCounterMatches("4", 4n)).not.to.throw();
    expect(() => assertFreshMarketCounterMatches("3", 4n)).to.throw(/changed after the market scan/);
    expect(() => assertFreshMarketCounterMatches(null, 4n)).to.throw(/changed after the market scan/);
  });

  it("decodes the lifecycle state from the finalized Anchor account bytes", () => {
    const data = Buffer.alloc(384);
    data[381] = 0;
    expect(marketStateFromAccountData(data)).to.equal("draft");
    data[381] = 1;
    expect(marketStateFromAccountData(data)).to.equal("open");
    data[381] = 6;
    expect(marketStateFromAccountData(data)).to.equal("closed");
    data[381] = 7;
    expect(marketStateFromAccountData(data)).to.equal("cancelled");
    expect(marketStateFromAccountData(Buffer.alloc(383))).to.equal(null);
  });

  it("recognizes only a Draft with zero shares and liabilities as empty", () => {
    const data = Buffer.alloc(384);
    expect(isEmptyDraftMarketAccountData(data)).to.equal(true);
    for (const offset of [MARKET_ACCOUNT_LAYOUT.totalShares, ...MARKET_ACCOUNT_LAYOUT.accountingValues]) {
      const nonEmpty = Buffer.from(data);
      nonEmpty.writeBigUInt64LE(1n, offset);
      expect(isEmptyDraftMarketAccountData(nonEmpty), `offset ${offset}`).to.equal(false);
    }
    const notDraft = Buffer.from(data);
    notDraft[MARKET_ACCOUNT_LAYOUT.status] = 1;
    expect(isEmptyDraftMarketAccountData(notDraft)).to.equal(false);
    const settled = Buffer.from(data);
    settled[MARKET_ACCOUNT_LAYOUT.result] = 1;
    expect(isEmptyDraftMarketAccountData(settled)).to.equal(false);
    expect(isEmptyDraftMarketAccountData(Buffer.alloc(383))).to.equal(false);
  });

  it("validates the exact UTC-aligned five-day seed schedule", () => {
    expect(isValidDesMoinesSeedSchedule(pricing)).to.equal(true);
    expect(isValidDesMoinesSeedSchedule({ ...pricing, observationStart: pricing.observationStart + 1 })).to.equal(false);
    expect(isValidDesMoinesSeedSchedule({ ...pricing, observationEnd: pricing.observationEnd + 1 })).to.equal(false);
    expect(isValidDesMoinesSeedSchedule({ ...pricing, salesCloseAt: Number.NaN })).to.equal(false);
  });

  it("normalizes API status enum keys so it can be compared to chain bytes", () => {
    expect(marketStateFromStatusJson('{"awaitingSettlement":{}}')).to.equal("awaiting_settlement");
    expect(marketStateFromStatusJson('{"dataUnavailable":{}}')).to.equal("data_unavailable");
    expect(marketStateFromStatusJson('{"open":{}}')).to.equal("open");
    expect(marketStateFromStatusJson('{"cancelled":{}}')).to.equal("cancelled");
    expect(marketStateFromStatusJson("null")).to.equal(null);
  });
  it("creates, funds, and opens only when no market is finalized", () => {
    expect(planDesMoinesSeed(missing, pricing, 1_999_000_000)).to.deep.equal({
      steps: ["create", "fund", "open"],
      additionalFundingBase: DES_MOINES_SEED_LIQUIDITY_BASE,
      alreadyOpen: false,
    });
  });

  it("creates a new market ID after an empty Draft was explicitly cancelled", () => {
    expect(planDesMoinesSeed({ ...draft, state: "cancelled" }, pricing, 1_999_000_000)).to.deep.equal({
      steps: ["create", "fund", "open"],
      additionalFundingBase: DES_MOINES_SEED_LIQUIDITY_BASE,
      alreadyOpen: false,
    });
  });

  it("resumes an empty finalized Draft without trying to create it again", () => {
    expect(planDesMoinesSeed(draft, pricing, 1_999_000_000).steps).to.deep.equal(["fund", "open"]);
    expect(planDesMoinesSeed(draft, { ...pricing, salesCloseAt: pricing.salesCloseAt + 3_600 }, 1_999_000_000).steps).to.deep.equal(["fund", "open"]);
  });

  it("compares resume readiness against the exact observation window and NOAA quote commitment", () => {
    expect(seedTermsMatch(draft, { ...pricing, salesCloseAt: pricing.salesCloseAt + 3_600 })).to.equal(true);
    expect(seedTermsMatch(draft, { ...pricing, observationStart: pricing.observationStart + 86_400 })).to.equal(false);
    expect(seedTermsMatch(draft, { ...pricing, inputsHash: "cd".repeat(32) })).to.equal(false);
    expect(seedTermsMatch(draft, { ...pricing, premiumRateBps: pricing.premiumRateBps + 1 })).to.equal(false);
  });

  it("resumes a funded Draft with only the open approval", () => {
    const funded = { ...draft, totalShares: "2000000000" };
    const plan = planDesMoinesSeed(funded, pricing, 1_999_000_000);
    expect(plan.steps).to.deep.equal(["open"]);
    expect(plan.additionalFundingBase).to.equal(0n);
  });

  it("tops up only the missing amount when a funding transaction was partial", () => {
    const partial = { ...draft, totalShares: "750000000" };
    const plan = planDesMoinesSeed(partial, pricing, 1_999_000_000);
    expect(plan.steps).to.deep.equal(["fund", "open"]);
    expect(plan.additionalFundingBase).to.equal(1_250_000_000n);
  });

  it("never offers another seed when the market is already Open", () => {
    const open = { ...draft, state: "open" as const, totalShares: "2000000000" };
    expect(planDesMoinesSeed(open, pricing, 1_999_000_000)).to.deep.equal({ steps: [], additionalFundingBase: 0n, alreadyOpen: true });
  });

  it("requires a fresh market id after an expired Draft", () => {
    expect(() => planDesMoinesSeed(draft, pricing, pricing.salesCloseAt)).to.throw(/explicitly cancelled/);
    expect(planDesMoinesSeed({ ...draft, state: "cancelled" }, pricing, pricing.salesCloseAt).steps).to.deep.equal(["create", "fund", "open"]);
  });

  it("rejects reuse when any immutable NOAA pricing term changed", () => {
    expect(() => planDesMoinesSeed({ ...draft, quoteInputsHash: "cd".repeat(32) }, pricing, 1_999_000_000))
      .to.throw(/different immutable NOAA pricing terms/);
  });

  it("does not create a duplicate while another lifecycle state is active", () => {
    expect(() => planDesMoinesSeed({ ...draft, state: "locked" }, pricing, 1_999_000_000))
      .to.throw(/market is in progress/);
  });
});
