import { expect } from "chai";
import { AGRICULTURAL_MARKETS, calendarMonthlyWindow, millimetersToInches, searchAgriculturalMarkets, weeklyFridayWindow } from "../../shared/agricultural-markets";

describe("agricultural market registry", () => {
  it("contains the 12 research-gated crop-belt markets", () => {
    expect(AGRICULTURAL_MARKETS).to.have.length(12);
    expect(AGRICULTURAL_MARKETS.every((market) => market.metric === "cumulative_rainfall_mm" && market.evidenceStatus === "researching_evidence" && market.noaaStationId === null)).to.equal(true);
  });

  it("converts rainfall display units without changing the canonical mm value", () => {
    expect(millimetersToInches(25.4)).to.equal(1);
  });

  it("searches the release-gated catalog by area, country, region, crop, and accented names", () => {
    expect(searchAgriculturalMarkets("des").map((market) => market.slug)).to.deep.equal(["des-moines"]);
    expect(searchAgriculturalMarkets("canada").map((market) => market.slug)).to.deep.equal(["winnipeg"]);
    expect(searchAgriculturalMarkets("emerging coffee").map((market) => market.slug)).to.deep.equal(["arusha"]);
    expect(searchAgriculturalMarkets("cordoba").map((market) => market.slug)).to.deep.equal(["cordoba"]);
    expect(searchAgriculturalMarkets("")).to.have.length(12);
  });

  it("returns a forward weekly Friday and a full next calendar month", () => {
    const weekly = weeklyFridayWindow(new Date("2026-09-11T12:00:00Z"));
    const monthly = calendarMonthlyWindow(new Date("2026-09-11T12:00:00Z"));
    expect(weekly).to.deep.equal({ start: "2026-09-18", end: "2026-09-25" });
    expect(monthly).to.deep.equal({ start: "2026-10-01", end: "2026-11-01" });
  });
});
