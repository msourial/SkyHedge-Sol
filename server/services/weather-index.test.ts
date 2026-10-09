import { expect } from "chai";
import { completeWeeklyRainfall } from "./weather-index.js";

describe("completed NOAA weekly rainfall", () => {
  const dates = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];
  const records = dates.map((date) => ({ date, millimeters: 1.2 }));

  it("totals exactly seven distinct, quality-screened days in the half-open week", () => {
    expect(completeWeeklyRainfall(records, "2026-09-28", "2026-10-05")).to.equal(8.4);
  });

  it("leaves missing, duplicate, extra, or bad daily observations unavailable", () => {
    expect(completeWeeklyRainfall(records.slice(1), "2026-09-28", "2026-10-05")).to.equal(null);
    expect(completeWeeklyRainfall([...records.slice(0, -1), records[0]], "2026-09-28", "2026-10-05")).to.equal(null);
    expect(completeWeeklyRainfall([...records, { date: "2026-10-05", millimeters: 10 }], "2026-09-28", "2026-10-05")).to.equal(null);
    expect(completeWeeklyRainfall(records.map((record, index) => index === 3 ? { ...record, qualityFlag: "X" } : record), "2026-09-28", "2026-10-05")).to.equal(null);
    expect(completeWeeklyRainfall(records.map((record, index) => index === 3 ? { ...record, measurementFlag: "P" } : record), "2026-09-28", "2026-10-05")).to.equal(null);
  });
});
