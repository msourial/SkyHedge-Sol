import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCommittedQuoteRequest, getProtectionUnavailableReason, isOnchainMarketOpen, parseSkytAmount } from "./protection.ts";
import type { DevnetStatus } from "./api.ts";

const now = 1_800_000_000;

function readyStatus(): DevnetStatus {
  return {
    network: "devnet",
    program: { address: "program", status: "ready", executable: true, explorerUrl: "https://explorer.solana.com" },
    idl: { status: "ready", source: "local-committed-idl", instructionCount: 8, accountCount: 6, supportsEmptyDraftCancellation: false },
    protocol: { address: "protocol", status: "ready", initialized: true, admin: "admin", settlementAuthority: "settler", collateralMint: "mint", nextMarketId: "1" },
    feeVault: { address: "fee-vault", status: "ready", exists: true, balance: "0" },
    skytMint: { address: "mint", status: "ready", exists: true, decimals: 6, supply: "350000000000", mintAuthority: "admin" },
    desMoinesMarket: {
      status: "ready", address: "market", marketId: "0", vault: "vault", vaultBalance: "2000000000",
      onchainStatus: '{"open":{}}', salesCloseAt: now + 60, observationStart: now + 86_400,
      observationEnd: now + 518_400, thresholdMmX100: "5000", operator: "gte",
      quoteProbabilityBps: 4_000, premiumRateBps: 4_700, quoteInputsHash: "a".repeat(64),
      evidenceStatus: "validated", targetCityHash: "hash",
    },
    noaaEvidence: { status: "ready", settlementSource: "NOAA", message: "Validated station package", package: { stationId: "USW00014933" } },
    generatedAt: new Date(now * 1_000).toISOString(),
  };
}

describe("Devnet protection readiness", () => {
  it("converts human SKYT amounts exactly and enforces the tester cap", () => {
    assert.equal(parseSkytAmount("25.123456"), "25123456");
    assert.equal(parseSkytAmount("500"), "500000000");
    assert.equal(parseSkytAmount("500.000001"), null);
    assert.equal(parseSkytAmount("1.0000001"), null);
    assert.equal(parseSkytAmount("0"), null);
    assert.equal(parseSkytAmount("abc"), null);
  });

  it("allows quote and purchase preparation only when every finalized prerequisite is ready", () => {
    assert.equal(getProtectionUnavailableReason({ status: readyStatus(), citySlug: "des-moines", walletConnected: true, walletSkytBalanceBase: "100000000", amountBase: "100000000", nowSeconds: now }), null);
  });

  it("recognizes the finalized Anchor Open enum without accepting ambiguous states", () => {
    const status = readyStatus();
    status.desMoinesMarket.onchainStatus = '{"Open":{}}';
    assert.equal(isOnchainMarketOpen(status.desMoinesMarket.onchainStatus), true);
    assert.equal(getProtectionUnavailableReason({ status, citySlug: "des-moines", walletConnected: true, walletSkytBalanceBase: "100000000", amountBase: "100000000", nowSeconds: now }), null);
    assert.equal(isOnchainMarketOpen('{"Open":{},"Draft":{}}'), false);
    assert.equal(isOnchainMarketOpen('{"Draft":{}}'), false);
  });

  it("builds quote inputs exclusively from immutable finalized market terms", () => {
    const status = readyStatus();
    assert.deepEqual(buildCommittedQuoteRequest(status, "100000000"), {
      city: "des-moines", observationStart: new Date((now + 86_400) * 1_000).toISOString().slice(0, 10),
      observationEnd: new Date((now + 518_400) * 1_000).toISOString().slice(0, 10), thresholdMm: 50,
      operator: "gte", protectedAmount: "100000000",
    });
    status.desMoinesMarket.thresholdMmX100 = null;
    assert.equal(buildCommittedQuoteRequest(status, "100000000"), null);
  });

  it("fails closed when the NOAA package or market evidence is missing", () => {
    const status = readyStatus();
    status.noaaEvidence = { ...status.noaaEvidence, status: "unavailable", package: null };
    assert.match(getProtectionUnavailableReason({ status, citySlug: "des-moines", walletConnected: true, walletSkytBalanceBase: "100000000", amountBase: "100000000", nowSeconds: now }) ?? "", /NOAA/i);
  });

  it("fails closed for a non-open market, empty vault, or expired sales window", () => {
    for (const mutate of [
      (status: DevnetStatus) => { status.desMoinesMarket.onchainStatus = '{"locked":{}}'; },
      (status: DevnetStatus) => { status.desMoinesMarket.vaultBalance = "0"; },
      (status: DevnetStatus) => { status.desMoinesMarket.salesCloseAt = now; },
    ]) {
      const status = readyStatus();
      mutate(status);
      assert.notEqual(getProtectionUnavailableReason({ status, citySlug: "des-moines", walletConnected: true, walletSkytBalanceBase: "100000000", amountBase: "100000000", nowSeconds: now }), null);
    }
  });

  it("fails closed for other indexes, disconnected wallets, and amounts over 500 SKYT", () => {
    const status = readyStatus();
    assert.match(getProtectionUnavailableReason({ status, citySlug: "cordoba", walletConnected: true, walletSkytBalanceBase: "100000000", amountBase: "100000000", nowSeconds: now }) ?? "", /Des Moines/i);
    assert.match(getProtectionUnavailableReason({ status, citySlug: "des-moines", walletConnected: false, walletSkytBalanceBase: "100000000", amountBase: "100000000", nowSeconds: now }) ?? "", /wallet/i);
    assert.match(getProtectionUnavailableReason({ status, citySlug: "des-moines", walletConnected: true, walletSkytBalanceBase: "100000000", amountBase: "500000001", nowSeconds: now }) ?? "", /500 SKYT/i);
  });

  it("fails closed if executable code, the protocol, or the collateral mint is not verified", () => {
    const checks = [
      (status: DevnetStatus) => { status.program.executable = false; },
      (status: DevnetStatus) => { status.protocol.initialized = false; },
      (status: DevnetStatus) => { status.protocol.collateralMint = "other-mint"; },
    ];
    for (const mutate of checks) {
      const status = readyStatus();
      mutate(status);
      assert.notEqual(getProtectionUnavailableReason({ status, citySlug: "des-moines", walletConnected: true, walletSkytBalanceBase: "100000000", amountBase: "100000000", nowSeconds: now }), null);
    }
  });
});
