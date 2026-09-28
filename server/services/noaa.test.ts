import { expect } from "chai";
import { parseNoaaDailyRainfall, parseNoaaQpfGrid } from "./noaa";

describe("NOAA daily rainfall quality metadata", () => {
  it("preserves the GHCN-Daily measurement and quality flags", () => {
    expect(parseNoaaDailyRainfall({
      date: "2026-09-20T00:00:00",
      value: 2.5,
      attributes: ",,0,0700",
    })).to.deep.equal({
      date: "2026-09-20",
      millimeters: 2.5,
      measurementFlag: null,
      qualityFlag: null,
    });
  });

  it("accepts NOAA's documented trace-rainfall measurement flag", () => {
    expect(parseNoaaDailyRainfall({ date: "2026-09-20", value: 0, attributes: "T,,0,0700" }).measurementFlag).to.equal("T");
  });

  it("rejects records with a failed NOAA quality check", () => {
    expect(() => parseNoaaDailyRainfall({ date: "2026-09-20", value: 2.5, attributes: ",O,0,0700" })).to.throw(/quality flag/i);
  });

  it("rejects multi-day accumulations and missing-presumed-zero values", () => {
    for (const flag of ["A", "P"]) {
      expect(() => parseNoaaDailyRainfall({ date: "2026-09-20", value: 2.5, attributes: `${flag},,0,0700` })).to.throw(/measurement flag/i);
    }
  });

  it("fails closed when NOAA omits or malforms the attributes field", () => {
    expect(() => parseNoaaDailyRainfall({ date: "2026-09-20", value: 2.5 })).to.throw(/attributes/i);
    expect(() => parseNoaaDailyRainfall({ date: "2026-09-20", value: 2.5, attributes: "not-a-flag" })).to.throw(/attributes/i);
  });
});

describe("NOAA quantitative precipitation forecasts", () => {
  const start = Date.parse("2026-09-01T00:00:00Z");
  const intervals = Array.from({ length: 4 }, (_, index) => ({
    validTime: `${new Date(start + index * 6 * 60 * 60 * 1_000).toISOString()}/PT6H`,
    value: 1,
  }));

  it("uses quantitative precipitation amounts and converts their declared units", () => {
    const daily = parseNoaaQpfGrid({
      properties: { quantitativePrecipitation: { uom: "wmoUnit:in", values: intervals } },
    }, "2026-09-01", "2026-09-02");
    expect(daily).to.deep.equal([{ date: "2026-09-01", millimeters: 101.6 }]);
  });

  it("fails closed when NOAA does not cover the entire requested interval", () => {
    expect(() => parseNoaaQpfGrid({
      properties: { quantitativePrecipitation: { uom: "wmoUnit:mm", values: intervals.slice(0, 3) } },
    }, "2026-09-01", "2026-09-02")).to.throw(/does not fully cover/i);
  });

  it("does not reinterpret null, malformed, overlapping, or unsupported forecast data as zero", () => {
    const layer = (values: unknown[], uom = "wmoUnit:mm") => ({ properties: { quantitativePrecipitation: { uom, values } } });
    expect(() => parseNoaaQpfGrid(layer([{ ...intervals[0], value: null }]), "2026-09-01", "2026-09-02")).to.throw(/missing/i);
    expect(() => parseNoaaQpfGrid(layer([{ ...intervals[0], validTime: "bad", value: 0 }]), "2026-09-01", "2026-09-02")).to.throw(/malformed/i);
    expect(() => parseNoaaQpfGrid(layer([...intervals, intervals[0]]), "2026-09-01", "2026-09-02")).to.throw(/overlap/i);
    expect(() => parseNoaaQpfGrid(layer(intervals, "wmoUnit:unknown"), "2026-09-01", "2026-09-02")).to.throw(/unit/i);
  });

  it("rejects ranges outside the available QPF horizon instead of filling dates with zero", () => {
    expect(() => parseNoaaQpfGrid({ properties: { quantitativePrecipitation: { uom: "wmoUnit:mm", values: intervals } } },
      "2026-09-01", "2026-09-09")).to.throw(/does not fully cover/i);
  });
});
