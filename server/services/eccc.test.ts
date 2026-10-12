import { expect } from "chai";
import { ECCC_STATIONS, ecccClimateDailyUrl, parseEcccDaily } from "./eccc";

describe("ECCC climate-daily adapter", () => {
  it("pins Toronto Pearson as the Canadian pilot station", () => {
    expect(ECCC_STATIONS.toronto.climateId).to.equal("6158731");
  });
  it("builds a keyless GeoMet OGC API query", () => {
    expect(ecccClimateDailyUrl("6158731", "2026-10-01", "2026-10-07")).to.match(/api\.weather\.gc\.ca\/collections\/climate-daily\/items\?.*CLIMATE_IDENTIFIER=6158731/);
  });
  it("parses a clean and a trace record", () => {
    expect(parseEcccDaily({ properties: { LOCAL_DATE: "2026-10-10 00:00:00", TOTAL_PRECIPITATION: 4.2, TOTAL_PRECIPITATION_FLAG: null } }).millimeters).to.equal(4.2);
    expect(parseEcccDaily({ properties: { LOCAL_DATE: "2026-10-10", TOTAL_PRECIPITATION: 0, TOTAL_PRECIPITATION_FLAG: "T" } }).measurementFlag).to.equal("T");
  });
  it("refuses missing, estimated or unpublished values", () => {
    expect(() => parseEcccDaily({ properties: { LOCAL_DATE: "2026-10-10", TOTAL_PRECIPITATION: 3, TOTAL_PRECIPITATION_FLAG: "E" } })).to.throw(/not settlement-grade/);
    expect(() => parseEcccDaily({ properties: { LOCAL_DATE: "2026-10-11", TOTAL_PRECIPITATION: null } })).to.throw(/not published/);
  });
});
