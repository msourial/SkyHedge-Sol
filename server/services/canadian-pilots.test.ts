import { expect } from "chai";
import { canadianPilotActivationBlocker, completeForecastRainfall, completeHourlyRainfall, fiveDaySaskatoonWindow, saskatoonTriggerFromTen, torontoLocalDayWindow } from "./canadian-pilots";

describe("Canadian pilot observation windows", () => {
  it("uses five full UTC days after a 24-hour Saskatoon sales period", () => {
    const schedule = fiveDaySaskatoonWindow("2026-10-03T15:30:00Z");
    expect(schedule.salesCloseAt).to.equal("2026-10-04T15:30:00.000Z");
    expect(schedule.observationStart).to.equal("2026-10-05T00:00:00.000Z");
    expect(schedule.observationEnd).to.equal("2026-10-10T00:00:00.000Z");
  });

  it("converts full Toronto local days to immutable UTC windows across daylight-saving changes", () => {
    expect(torontoLocalDayWindow("2026-03-08")).to.deep.equal({ start: "2026-03-08T05:00:00.000Z", end: "2026-03-09T04:00:00.000Z", hours: 23 });
    expect(torontoLocalDayWindow("2026-11-01")).to.deep.equal({ start: "2026-11-01T04:00:00.000Z", end: "2026-11-02T05:00:00.000Z", hours: 25 });
  });

  it("requires complete, contiguous, quality-passing hourly rainfall for an exact local day", () => {
    const window = torontoLocalDayWindow("2026-03-08");
    const start = Date.parse(window.start);
    const records = Array.from({ length: 23 }, (_, index) => ({ start: new Date(start + index * 3_600_000).toISOString(), end: new Date(start + (index + 1) * 3_600_000).toISOString(), millimeters: index === 3 ? 1.2 : 0, quality: "passed" as const }));
    expect(completeHourlyRainfall(records, window.start, window.end)).to.equal(1.2);
    expect(() => completeHourlyRainfall(records.slice(1), window.start, window.end)).to.throw(/complete|gap/i);
    expect(() => completeHourlyRainfall(records.map((record, index) => index === 3 ? { ...record, quality: "failed" as const } : record), window.start, window.end)).to.throw(/quality/i);
    expect(() => completeHourlyRainfall([{ start: window.start, end: window.end, millimeters: 1.2, quality: "passed" }], window.start, window.end)).to.throw(/hourly/i);
  });

  it("fails closed on data rights, station quality, history, forecast, and missing hashes", () => {
    const evidence = { stationValidated: true, dataRightsConfirmed: false, tenHistoricalWindowsComplete: true, forecastWindowComplete: true, methodologyHash: "a".repeat(64), sourceHash: "b".repeat(64) };
    expect(canadianPilotActivationBlocker(evidence)).to.match(/rights/i);
    expect(canadianPilotActivationBlocker({ ...evidence, dataRightsConfirmed: true, stationValidated: false })).to.match(/station/i);
    expect(canadianPilotActivationBlocker({ ...evidence, dataRightsConfirmed: true, forecastWindowComplete: false })).to.match(/forecast/i);
    expect(canadianPilotActivationBlocker({ ...evidence, dataRightsConfirmed: true, sourceHash: null })).to.match(/source hash/i);
    expect(canadianPilotActivationBlocker({ ...evidence, dataRightsConfirmed: true })).to.equal(null);
  });

  it("proposes Saskatoon's low-rainfall trigger from the second-lowest of ten real totals", () => {
    expect(saskatoonTriggerFromTen([22, 4, 9, 18, 0, 13, 30, 11, 7, 26])).to.equal(4);
    expect(() => saskatoonTriggerFromTen([0, 4])).to.throw(/ten/i);
    expect(() => saskatoonTriggerFromTen([0, 4, 7, 9, 11, 13, 18, 22, 26, Number.NaN])).to.throw(/valid/i);
  });

  it("requires decoded forecast intervals to cover every minute of Saskatoon's exact five-day window", () => {
    const window = fiveDaySaskatoonWindow("2026-10-03T15:30:00Z");
    const start = Date.parse(window.observationStart);
    const threeHours = 3 * 3_600_000;
    const intervals = Array.from({ length: 40 }, (_, index) => ({
      start: new Date(start + index * threeHours).toISOString(),
      end: new Date(start + (index + 1) * threeHours).toISOString(),
      millimeters: index < 2 ? 0.4 : 0,
    }));
    expect(completeForecastRainfall(intervals, window.observationStart, window.observationEnd)).to.equal(0.8);
    expect(() => completeForecastRainfall(intervals.slice(1), window.observationStart, window.observationEnd)).to.throw(/gap|complete/i);
    expect(() => completeForecastRainfall(intervals.slice(0, -1), window.observationStart, window.observationEnd)).to.throw(/complete/i);
    expect(() => completeForecastRainfall([...intervals, intervals[1]], window.observationStart, window.observationEnd)).to.throw(/overlap/i);
    expect(() => completeForecastRainfall(intervals.map((record, index) => index === 1 ? { ...record, millimeters: null } : record), window.observationStart, window.observationEnd)).to.throw(/malformed|missing/i);
    expect(() => completeForecastRainfall([null as unknown as typeof intervals[number]], window.observationStart, window.observationEnd)).to.throw(/malformed|missing/i);
  });

  it("rejects a forecast interval crossing a Toronto local-day boundary instead of prorating it", () => {
    const window = torontoLocalDayWindow("2026-03-08");
    const start = Date.parse(window.start);
    const hourly = Array.from({ length: window.hours }, (_, index) => ({
      start: new Date(start + index * 3_600_000).toISOString(),
      end: new Date(start + (index + 1) * 3_600_000).toISOString(),
      millimeters: 0,
    }));
    expect(completeForecastRainfall(hourly, window.start, window.end)).to.equal(0);
    expect(() => completeForecastRainfall([
      { start: new Date(start - 3_600_000).toISOString(), end: new Date(start + 2 * 3_600_000).toISOString(), millimeters: 1 },
      ...hourly.slice(2),
    ], window.start, window.end)).to.throw(/align|boundary/i);
  });
});
