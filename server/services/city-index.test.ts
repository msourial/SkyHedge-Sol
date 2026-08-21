import { expect } from "chai";
import { CITY_INDEX, cityByHash, cityBySlug, cityHash, upcomingWeeklyWindows, weeklyWindowFor, windowNormalMm } from "../../shared/cities";
import { NOAA_STATIONS } from "./noaa";
import { searchCities } from "./city-index";

describe("City registry (12 global cities, GHCN/GSOD resolution, climate normals)", () => {
  it("commits exactly 12 index cities with unique slugs", () => {
    expect(CITY_INDEX.length).to.eq(12);
    const slugs = CITY_INDEX.map((c) => c.slug);
    expect(new Set(slugs).size).to.eq(slugs.length);
  });

  it("has GHCN/GSOD station ids and 12 monthly normals per city", () => {
    for (const city of CITY_INDEX) {
      expect(city.noaaDataset, city.slug).to.be.oneOf(["GHCND", "GSOD"]);
      expect(city.noaaStationId, city.slug).to.match(/^(GHCND|GSOD):[A-Z0-9]+$/);
      expect(city.monthlyNormalsMm.length, city.slug).to.eq(12);
      expect(city.monthlyNormalsMm.every((mm) => mm >= 0), city.slug).to.eq(true);
    }
  });

  it("covers every city in the server station map", () => {
    for (const city of CITY_INDEX) {
      expect(NOAA_STATIONS[city.slug], `missing station pin: ${city.slug}`).to.not.be.undefined;
      expect(NOAA_STATIONS[city.slug].stationId).to.eq(city.noaaStationId);
    }
  });

  it("assigns a coverage tier to every city", () => {
    for (const city of CITY_INDEX) {
      expect(city.coverageTier, city.slug).to.be.oneOf(["A", "B", "C"]);
    }
  });

  it("resolves slugs and on-chain city hashes", () => {
    expect(cityBySlug("london")?.name).to.eq("London");
    expect(cityBySlug("nope")).to.be.undefined;
    expect(cityByHash(cityHash("tokyo"))?.slug).to.eq("tokyo");
  });

  it("computes weekly windows as Monday-to-Monday UTC", () => {
    const wednesday = new Date("2026-08-19T12:00:00Z"); // a Wednesday
    const { start, end } = weeklyWindowFor(wednesday);
    expect(start.toISOString().slice(0, 10)).to.eq("2026-08-17");
    expect(end.toISOString().slice(0, 10)).to.eq("2026-08-24");
    expect(upcomingWeeklyWindows(wednesday, 4).length).to.eq(4);
  });

  it("prorates window normals by day overlap", () => {
    const mumbai = cityBySlug("mumbai")!;
    const fullWeek = upcomingWeeklyWindows(new Date("2026-06-01T00:00:00Z"), 1)[0];
    const weekNormal = windowNormalMm(mumbai, fullWeek.start.getTime(), fullWeek.end.getTime());
    expect(weekNormal).to.be.greaterThan(0);
  });
});

describe("City search index", () => {
  it("returns an empty list for an empty query", () => {
    expect(searchCities("")).to.deep.eq([]);
    expect(searchCities("   ")).to.deep.eq([]);
  });

  it("ranks an exact name match first with a perfect score", () => {
    const results = searchCities("london");
    expect(results[0].slug).to.eq("london");
    expect(results[0].score).to.eq(100);
  });

  it("resolves aliases (nyc, sf-like city abbreviations, vegas-style nicknames)", () => {
    expect(searchCities("nyc")[0].slug).to.eq("new-york");
    expect(searchCities("bombay")[0].slug).to.eq("mumbai");
    expect(searchCities("japan")[0].slug).to.eq("tokyo");
  });

  it("matches countries and country codes", () => {
    expect(searchCities("brazil")[0].slug).to.eq("sao-paulo");
    expect(searchCities("ng")[0].slug).to.eq("lagos");
    expect(searchCities("australia")[0].slug).to.eq("sydney");
  });

  it("fuzzily matches typos against city names", () => {
    expect(searchCities("sao paulo")[0].slug).to.eq("sao-paulo");
    expect(searchCities("singapre")[0].slug).to.eq("singapore");
    expect(searchCities("new yrok")[0].slug).to.eq("new-york");
  });

  it("returns only committed registry cities with normalized slugs", () => {
    for (const result of searchCities("o")) {
      expect(cityBySlug(result.slug)).to.not.be.undefined;
      expect(result.slug).to.eq(result.slug.toLowerCase());
      expect(result.stationId).to.eq(cityBySlug(result.slug)!.noaaStationId);
    }
  });
});