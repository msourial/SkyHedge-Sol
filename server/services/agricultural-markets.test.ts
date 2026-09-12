import { expect } from "chai";
import { AGRICULTURAL_MARKETS, agriculturalMarketLocation, calendarMonthlyWindow, millimetersToInches, searchAgriculturalMarkets, weeklyFridayWindow } from "../../shared/agricultural-markets";

describe("agricultural market registry", () => {
  it("contains the 12 research-gated crop-belt markets", () => {
    expect(AGRICULTURAL_MARKETS).to.have.length(12);
    expect(AGRICULTURAL_MARKETS.every((market) => market.metric === "cumulative_rainfall_mm" && market.locality.length > 0 && market.administrativeArea.length > 0 && market.evidenceStatus === "researching_evidence" && market.noaaStationId === null)).to.equal(true);
    expect(AGRICULTURAL_MARKETS.map(agriculturalMarketLocation)).to.deep.equal([
      "Des Moines, Iowa, United States",
      "Fresno, California, United States",
      "Lubbock, Texas, United States",
      "Winnipeg, Manitoba, Canada",
      "Córdoba, Córdoba Province, Argentina",
      "Sorriso, Mato Grosso, Brazil",
      "Asunción, Capital District, Paraguay",
      "Santa Cruz, Santa Cruz Department, Bolivia",
      "Ludhiana, Punjab, India",
      "Nagpur, Maharashtra, India",
      "Eldoret, Uasin Gishu County, Kenya",
      "Arusha, Arusha Region, Tanzania",
    ]);
  });

  it("pins a valid, distinct reference coordinate for every mapped area", () => {
    const coordinates = AGRICULTURAL_MARKETS.map((market) => `${market.latitude},${market.longitude}`);
    expect(new Set(coordinates).size).to.equal(AGRICULTURAL_MARKETS.length);
    expect(AGRICULTURAL_MARKETS.every((market) => Number.isFinite(market.latitude) && market.latitude >= -85 && market.latitude <= 85 && Number.isFinite(market.longitude) && market.longitude >= -180 && market.longitude <= 180)).to.equal(true);
  });

  it("converts rainfall display units without changing the canonical mm value", () => {
    expect(millimetersToInches(25.4)).to.equal(1);
  });

  it("searches the release-gated catalog by area, country, region, crop, and accented names", () => {
    expect(searchAgriculturalMarkets("des").map((market) => market.slug)).to.deep.equal(["des-moines"]);
    expect(searchAgriculturalMarkets("canada").map((market) => market.slug)).to.deep.equal(["winnipeg"]);
    expect(searchAgriculturalMarkets("emerging coffee").map((market) => market.slug)).to.deep.equal(["arusha"]);
    expect(searchAgriculturalMarkets("cordoba").map((market) => market.slug)).to.deep.equal(["cordoba"]);
    expect(searchAgriculturalMarkets("texas").map((market) => market.slug)).to.deep.equal(["lubbock"]);
    expect(searchAgriculturalMarkets("lubbock").map((market) => market.slug)).to.deep.equal(["lubbock"]);
    expect(searchAgriculturalMarkets("punjab").map((market) => market.slug)).to.deep.equal(["ludhiana"]);
    expect(searchAgriculturalMarkets("")).to.have.length(12);
    expect(agriculturalMarketLocation(AGRICULTURAL_MARKETS[2])).to.equal("Lubbock, Texas, United States");
  });

  it("returns a forward weekly Friday and a full next calendar month", () => {
    const weekly = weeklyFridayWindow(new Date("2026-09-11T12:00:00Z"));
    const monthly = calendarMonthlyWindow(new Date("2026-09-11T12:00:00Z"));
    expect(weekly).to.deep.equal({ start: "2026-09-18", end: "2026-09-25" });
    expect(monthly).to.deep.equal({ start: "2026-10-01", end: "2026-11-01" });
  });
});
