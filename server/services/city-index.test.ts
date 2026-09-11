import { expect } from "chai";
import { CITY_INDEX, cityByHash, cityBySlug, cityHash, upcomingWeeklyWindows, weeklyWindowFor, windowNormalMm } from "../../shared/cities";
import { NOAA_STATIONS } from "./noaa";
import { searchCities } from "./city-index";

describe("V1 city registry (three NOAA-pinned US cities)", () => {
  it("commits exactly New York, Miami, and Chicago", () => {
    expect(CITY_INDEX.length).to.eq(3);
    const slugs = CITY_INDEX.map((c) => c.slug);
    expect(slugs).to.have.members(["new-york", "miami", "chicago"]);
    expect(new Set(slugs).size).to.eq(slugs.length);
  });

  it("has GHCN station ids and 12 monthly normals per city", () => {
    for (const city of CITY_INDEX) {
      expect(city.noaaDataset, city.slug).to.eq("GHCND");
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
    expect(cityBySlug("miami")?.name).to.eq("Miami");
    expect(cityBySlug("nope")).to.be.undefined;
    expect(cityByHash(cityHash("chicago"))?.slug).to.eq("chicago");
  });

  it("computes weekly windows as Monday-to-Monday UTC", () => {
    const wednesday = new Date("2026-08-19T12:00:00Z"); // a Wednesday
    const { start, end } = weeklyWindowFor(wednesday);
    expect(start.toISOString().slice(0, 10)).to.eq("2026-08-17");
    expect(end.toISOString().slice(0, 10)).to.eq("2026-08-24");
    expect(upcomingWeeklyWindows(wednesday, 4).length).to.eq(4);
  });

  it("prorates window normals by day overlap", () => {
    const miami = cityBySlug("miami")!;
    const fullWeek = upcomingWeeklyWindows(new Date("2026-06-01T00:00:00Z"), 1)[0];
    const weekNormal = windowNormalMm(miami, fullWeek.start.getTime(), fullWeek.end.getTime());
    expect(weekNormal).to.be.greaterThan(0);
  });
});

describe("City search index", () => {
  it("returns an empty list for an empty query", () => {
    expect(searchCities("")).to.deep.eq([]);
    expect(searchCities("   ")).to.deep.eq([]);
  });

  it("ranks an exact name match first with a perfect score", () => {
    const results = searchCities("miami");
    expect(results[0].slug).to.eq("miami");
    expect(results[0].score).to.eq(100);
  });

  it("resolves the V1 New York alias", () => {
    expect(searchCities("nyc")[0].slug).to.eq("new-york");
  });

  it("fuzzily matches typos against city names", () => {
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
