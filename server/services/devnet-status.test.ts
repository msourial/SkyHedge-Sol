import { expect } from "chai";
import { Connection } from "@solana/web3.js";
import { DevnetStatusReader } from "./devnet-status";
import { committedIdlMatchesProgram, hasPinnedDesMoinesEvidenceCommitment, latestMatchingMarket, marketTermsFields, noaaStationValidationMessage, protocolConfigFields, publicDevnetStatus } from "./devnet-status";
import { canonicalSourceHash, NOAA_STATIONS } from "./noaa";
import methodology from "../../shared/methodology-v1.json";

describe("DevnetStatusReader protocol decoding", () => {
  it("reads snake-case fields emitted by the committed Anchor IDL", () => {
    const key = { toBase58: () => "Settlement111111111111111111111111111111111" };
    const mint = { toBase58: () => "Mint111111111111111111111111111111111111111" };
    const nextMarketId = { toString: () => "7" };

    expect(protocolConfigFields({
      settlement_authority: key,
      collateral_mint: mint,
      next_market_id: nextMarketId,
    })).to.deep.equal({
      settlementAuthority: "Settlement111111111111111111111111111111111",
      collateralMint: "Mint111111111111111111111111111111111111111",
      nextMarketId: "7",
    });
  });
});

describe("Committed IDL identity", () => {
  it("only reports an IDL ready when its declared program address matches", () => {
    expect(committedIdlMatchesProgram({ address: "Program111" }, "Program111")).to.equal(true);
    expect(committedIdlMatchesProgram({ address: "Different111" }, "Program111")).to.equal(false);
    expect(committedIdlMatchesProgram({}, "Program111")).to.equal(false);
  });
});

describe("Public Devnet status", () => {
  it("never exposes the configured RPC access URL", () => {
    const status = publicDevnetStatus({ network: "devnet", rpcUrl: "https://rpc.example/key-secret" });
    expect(status).to.deep.equal({ network: "devnet" });
    expect(JSON.stringify(status)).not.to.include("key-secret");
  });

  it("propagates finalized-RPC failures instead of disguising them as missing accounts", async () => {
    const offlineConnection = {
      getAccountInfo: async () => { throw new Error("Devnet RPC offline"); },
    } as unknown as Connection;
    const reader = new DevnetStatusReader(offlineConnection);
    let message = "";
    try { await reader.read(); } catch (error) { message = error instanceof Error ? error.message : ""; }
    expect(message).to.equal("Devnet RPC offline");
  });
});

describe("Des Moines NOAA evidence commitment", () => {
  it("distinguishes historical station validation from future settlement and pricing evidence", () => {
    const message = noaaStationValidationMessage("2026-09-13", "2026-09-20");
    expect(message).to.include("Historical NOAA sample for 2026-09-13 through 2026-09-20");
    expect(message).to.include("confirms station data availability only");
    expect(message).to.include("does not validate a future market window, settlement rainfall, or pricing");
  });

  it("uses the immutable market commitment rather than comparing against a rolling current-week package", () => {
    const hash = (value: string) => Array.from(Buffer.from(value, "hex"));
    const quoteInputsHash = "33".repeat(32);
    const committed = {
      station_id_hash: hash(canonicalSourceHash(NOAA_STATIONS["des-moines"].stationId)),
      provider_hash: hash(canonicalSourceHash(methodology)),
      methodology_hash: hash(canonicalSourceHash(methodology.version)),
      quote_inputs_hash: hash(quoteInputsHash),
    };
    expect(hasPinnedDesMoinesEvidenceCommitment(committed)).to.equal(true);
    // The live package changes week-to-week; the market's original hash remains pinned.
    expect(hasPinnedDesMoinesEvidenceCommitment({ ...committed, quote_inputs_hash: hash("44".repeat(32)) })).to.equal(true);
    expect(hasPinnedDesMoinesEvidenceCommitment({ ...committed, quote_inputs_hash: hash("00".repeat(32)) })).to.equal(false);
    expect(hasPinnedDesMoinesEvidenceCommitment({ ...committed, station_id_hash: hash("00".repeat(32)) })).to.equal(false);
    expect(hasPinnedDesMoinesEvidenceCommitment({ ...committed, provider_hash: hash("11".repeat(32)) })).to.equal(false);
    expect(hasPinnedDesMoinesEvidenceCommitment({ ...committed, methodology_hash: hash("00".repeat(32)) })).to.equal(false);
  });
});

describe("DevnetStatusReader market decoding", () => {
  it("selects the newest matching Des Moines market instead of an expired older draft", () => {
    const latest = latestMatchingMarket([
      { id: 0n, cityHash: "des-moines", state: "expired-draft" },
      { id: 1n, cityHash: "other-city", state: "other" },
      { id: 2n, cityHash: "des-moines", state: "fresh-draft" },
    ], new Set(["des-moines"]));

    expect(latest).to.deep.equal({ id: 2n, cityHash: "des-moines", state: "fresh-draft" });
  });

  it("reads immutable snake-case market timing fields from the committed Anchor IDL", () => {
    const value = { toString: () => "2000000000" };
    expect(marketTermsFields({
      sales_close_at: value,
      observation_start: { toString: () => "2000086400" },
      observation_end: { toString: () => "2000691200" },
      threshold_mm_x100: { toString: () => "5000" },
      operator: { greaterThanOrEqual: {} },
      quote_probability_bps: 2_000,
      premium_rate_bps: 2_400,
      quote_inputs_hash: Array.from(Buffer.from("33".repeat(32), "hex")),
    })).to.deep.equal({
      salesCloseAt: 2_000_000_000,
      observationStart: 2_000_086_400,
      observationEnd: 2_000_691_200,
      thresholdMmX100: "5000",
      operator: "gte",
      quoteProbabilityBps: 2_000,
      premiumRateBps: 2_400,
      quoteInputsHash: "33".repeat(32),
    });
  });
});
