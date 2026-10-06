import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgriculturalMarket, CityIndex, DevnetStatus } from "./api";
import { formatOnchainMarketStatus, formatUsdPreview, isMarketReadyForCity, rainfallBarPercent, recentNoaaHistoryForArea, researchLocationLabel, resolveSelectedNoaaCity, riskChoiceForArea, searchAgriculturalMarkets } from "./presentation.ts";

const markets: AgriculturalMarket[] = [
  {
    slug: "des-moines",
    name: "Des Moines crop belt",
    locality: "Des Moines",
    region: "North America",
    country: "United States",
    administrativeArea: "Iowa",
    latitude: 41.59,
    longitude: -93.62,
    crops: ["corn", "soybeans"],
    agriculturalContext: "Corn and soybean production",
    evidenceStatus: "researching_evidence",
    noaaStationId: null,
  },
  {
    slug: "cordoba",
    name: "Córdoba grain belt",
    locality: "Córdoba",
    region: "South America",
    country: "Argentina",
    administrativeArea: "Córdoba Province",
    latitude: -31.42,
    longitude: -64.19,
    crops: ["soybeans", "corn", "wheat"],
    agriculturalContext: "Rain-fed grain production",
    evidenceStatus: "researching_evidence",
    noaaStationId: null,
  },
];

const readyStatus: DevnetStatus = {
  network: "devnet",
  program: { address: "program", status: "ready", executable: true, explorerUrl: "" },
  idl: { status: "ready", source: "test", instructionCount: 1, accountCount: 1, supportsEmptyDraftCancellation: false },
  protocol: { address: "protocol", status: "ready", initialized: true, admin: null, settlementAuthority: null, collateralMint: "mint", nextMarketId: "1" },
  feeVault: { address: "fee-vault", status: "ready", exists: true, balance: "0" },
  skytMint: { address: "mint", status: "ready", exists: true, decimals: 6, supply: "0", mintAuthority: null },
  desMoinesMarket: { status: "ready", address: "market", marketId: "0", vault: "vault", vaultBalance: "1", onchainStatus: "open", salesCloseAt: 1, observationStart: 2, observationEnd: 3, thresholdMmX100: "1", operator: "gte", quoteProbabilityBps: 1, premiumRateBps: 1, quoteInputsHash: "01", evidenceStatus: "validated", targetCityHash: "hash" },
  noaaEvidence: { status: "ready", settlementSource: "NOAA", message: "Evidence package is available.", package: { stationId: "station" } },
  generatedAt: "",
};

describe("mobile presentation behavior", () => {
  it("formats only a valid non-binding USD preview, without a test-token conversion", () => {
    assert.equal(formatUsdPreview("100"), "$100");
    assert.equal(formatUsdPreview("125.50"), "$125.50");
    assert.equal(formatUsdPreview(""), null);
    assert.equal(formatUsdPreview("0"), null);
    assert.equal(formatUsdPreview("100 SKYT"), null);
  });
  it("keeps a research-only location selected without replacing it with a published NOAA index", () => {
    const published = [{ slug: "des-moines", name: "Des Moines" }] as CityIndex[];
    assert.equal(resolveSelectedNoaaCity("des-moines", published), published[0]);
    assert.equal(resolveSelectedNoaaCity("toronto", published), null);
    assert.equal(resolveSelectedNoaaCity("cordoba", published), null);
  });

  it("names both Canadian pilot locations in the no-observations state", () => {
    assert.equal(researchLocationLabel("toronto", undefined), "Toronto, Ontario, Canada");
    assert.equal(researchLocationLabel("saskatoon", undefined), "Saskatoon, Saskatchewan, Canada");
    assert.equal(researchLocationLabel("cordoba", markets[1]), "Córdoba, Córdoba Province, Argentina");
    assert.equal(researchLocationLabel("unknown", undefined), null);
  });

  it("never displays another area's NOAA rainfall diagram", () => {
    const city = { slug: "des-moines", weeklyHistoryMm: [{ week: "2026-09-07", mm: 21.4 }] } as CityIndex;
    assert.deepEqual(recentNoaaHistoryForArea("des-moines", city), city.weeklyHistoryMm);
    assert.equal(recentNoaaHistoryForArea("toronto", city), null);
    assert.equal(recentNoaaHistoryForArea("cordoba", city), null);
  });

  it("shows zero observed rainfall as an empty bar, not a positive-looking bar", () => {
    assert.equal(rainfallBarPercent(0, 20), 0);
    assert.equal(rainfallBarPercent(10, 20), 50);
    assert.equal(rainfallBarPercent(null, 20), null);
    assert.equal(rainfallBarPercent(-1, 20), null);
  });

  it("offers details only for rainfall, without promoting wind or snow into a purchase flow", () => {
    assert.equal(riskChoiceForArea("des-moines", "rainfall").canReview, true);
    assert.match(riskChoiceForArea("des-moines", "rainfall").detail, /Draft|readiness/i);
    assert.equal(riskChoiceForArea("toronto", "rainfall").canReview, true);
    assert.match(riskChoiceForArea("toronto", "rainfall").detail, /research/i);
    assert.equal(riskChoiceForArea("des-moines", "wind-gust").canReview, false);
    assert.equal(riskChoiceForArea("des-moines", "snowfall").canReview, false);
  });

  it("matches market names, locations, regions, countries, and crops without accent sensitivity", () => {
    assert.deepEqual(searchAgriculturalMarkets(markets, "cordoba"), [markets[1]]);
    assert.deepEqual(searchAgriculturalMarkets(markets, "Iowa"), [markets[0]]);
    assert.deepEqual(searchAgriculturalMarkets(markets, "soybean"), markets);
  });

  it("returns the full catalog for a blank search", () => {
    assert.deepEqual(searchAgriculturalMarkets(markets, "  "), markets);
  });

  it("matches countries, regions, and agricultural context", () => {
    assert.deepEqual(searchAgriculturalMarkets(markets, "South America"), [markets[1]]);
    assert.deepEqual(searchAgriculturalMarkets(markets, "Argentina wheat"), [markets[1]]);
  });

  it("does not apply Des Moines readiness to another selected city", () => {
    assert.equal(isMarketReadyForCity("chicago", readyStatus), false);
    assert.equal(isMarketReadyForCity("des-moines", readyStatus), true);
    assert.equal(isMarketReadyForCity("des-moines", null), false);
    assert.equal(isMarketReadyForCity("des-moines", {
      ...readyStatus,
      desMoinesMarket: { ...readyStatus.desMoinesMarket, evidenceStatus: "researching_evidence" },
    }), false);
  });

  it("marks a funded market ready when finalized Anchor status uses an uppercase Open key", () => {
    assert.equal(isMarketReadyForCity("des-moines", {
      ...readyStatus,
      desMoinesMarket: { ...readyStatus.desMoinesMarket, onchainStatus: '{"Open":{}}' },
    }), true);
  });

  it("renders Anchor enum values as readable market states", () => {
    assert.equal(formatOnchainMarketStatus('{"Draft":{}}'), "Draft");
    assert.equal(formatOnchainMarketStatus('{"awaitingSettlement":{}}'), "Awaiting Settlement");
    assert.equal(formatOnchainMarketStatus("data_unavailable"), "Data Unavailable");
    assert.equal(formatOnchainMarketStatus(null), "Unavailable");
  });
});
