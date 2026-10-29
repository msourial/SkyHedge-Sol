import { expect } from "chai";
import fixture from "./fixtures/r3-ensemble.json" with { type: "json" };
import { ensembleNative, forecastFromEnsemble, ForecastExceedanceReader } from "./forecast-exceedance.js";
import type { CoverProgress } from "../../shared/weather-signals.js";
import { edgeChip } from "../../shared/weather-signals.js";

const window = { city: "new-york" as const, peril: "rain" as const, start: "2026-10-30", end: "2026-11-02", trigger: 3 };
const now = new Date("2026-10-29T16:00:00Z");
const options = { now, fetchedAt: now.toISOString() };
const copy = () => structuredClone(fixture);
const observed = (overrides: Partial<CoverProgress> = {}): CoverProgress => ({ valueNative: 1, unit: "mm", observedThrough: "2026-10-29", daysReported: 1, daysTotal: 1, complete: true, state: "complete", source: "NOAA GHCN-Daily via CDO v2", fetchedAt: now.toISOString(), ...overrides });

describe("GEFS exact-window exceedance", () => {
  it("counts the control plus 30 members against the exact window trigger", () => {
    const result = forecastFromEnsemble(window, fixture, options)!;
    expect(result).to.include({ probability: 21 / 31, membersAtOrAbove: 21, membersTotal: 31, unit: "mm", trigger: 3, windowStart: window.start, windowEnd: window.end,
      source: "NOAA GEFS ensemble", model: "NOAA GEFS (gfs_seamless) via Open-Meteo Ensemble API", issuedAt: null });
  });
  it("respects strict and downward market operators", () => {
    expect(forecastFromEnsemble({ ...window, operator: "gt" }, fixture, options)!.membersAtOrAbove).to.equal(20);
    expect(forecastFromEnsemble({ ...window, operator: "lt" }, fixture, options)!.membersAtOrAbove).to.equal(10);
    expect(forecastFromEnsemble({ ...window, operator: "lte" }, fixture, options)!.membersAtOrAbove).to.equal(11);
  });
  it("returns a probability for a weekly window ending on forecast day 10", async () => {
    // Today is Oct 29 (day 0); Nov 8 (day 10) was null with gfs025.
    const time = Array.from({ length: 11 }, (_, day) => new Date(now.getTime() + day * 86_400_000).toISOString().slice(0, 10));
    const daily: Record<string, unknown> = { time };
    const daily_units: Record<string, string> = {};
    for (let member = 0; member <= 30; member++) {
      const field = member === 0 ? "precipitation_sum" : `precipitation_sum_member${String(member).padStart(2, "0")}`;
      daily[field] = time.map(() => member < 21 ? 1 : 0);
      daily_units[field] = "mm";
    }
    const body = { daily, daily_units };
    const weekly = { ...window, start: "2026-11-02", end: "2026-11-09", trigger: 6 };
    const reader = new ForecastExceedanceReader({ now: () => now, fetcher: async (url) => {
      const query = new URL(String(url)).searchParams;
      expect(query.get("models")).to.equal("gfs_seamless");
      expect(query.get("forecast_days")).to.equal("35");
      return new Response(JSON.stringify(body));
    } });
    expect(await reader.read(weekly)).to.include({ probability: 21 / 31, membersAtOrAbove: 21, membersTotal: 31 });
    // An incomplete trajectory is excluded from both numerator and denominator.
    (daily.precipitation_sum as (number | null)[])[10] = null;
    expect(forecastFromEnsemble(weekly, body, options)).to.include({ probability: 20 / 30, membersAtOrAbove: 20, membersTotal: 30 });
  });
  it("requires every requested day inside the returned horizon, including monthly windows", () => {
    expect(forecastFromEnsemble({ ...window, end: "2026-11-03" }, fixture, options)).to.equal(null);
    expect(forecastFromEnsemble({ ...window, end: "2026-12-01" }, fixture, options)).to.equal(null);
    const body = copy(); body.daily.time[1] = "2026-11-03";
    expect(forecastFromEnsemble(window, body, options)).to.equal(null);
  });
  it("never substitutes a past forecast for missing observations", () => {
    const started = { ...window, start: "2026-10-29" };
    const opts = { ...options, now: new Date("2026-10-30T16:00:00Z") };
    for (const obs of [null, observed({ complete: false }), observed({ valueNative: null }), observed({ daysReported: 0 }), observed({ observedThrough: "2026-10-28" })]) {
      expect(forecastFromEnsemble(started, fixture, { ...opts, observed: obs })).to.equal(null);
    }
  });
  it("combines a complete observed prefix with each member's remaining sum", () => {
    const result = forecastFromEnsemble({ ...window, start: "2026-10-29", trigger: 4 }, fixture, { ...options, now: new Date("2026-10-30T16:00:00Z"), observed: observed() })!;
    expect(result.membersAtOrAbove).to.equal(21);
  });
  it("uses snowfall depth cm -> settlement SNOW mm with sum aggregation", () => {
    expect(forecastFromEnsemble({ ...window, peril: "snow", trigger: 6 }, fixture, options)).to.include({ probability: 1, membersTotal: 31, unit: "mm" });
    expect(forecastFromEnsemble({ ...window, peril: "snow", trigger: 7 }, fixture, options)).to.include({ probability: 0 });
  });
  it("uses maximum TMAX, including maximum of observed and future days", () => {
    expect(forecastFromEnsemble({ ...window, peril: "heat", trigger: 30 }, fixture, options)).to.include({ probability: 0, unit: "°C" });
    expect(forecastFromEnsemble({ ...window, peril: "heat", start: "2026-10-29", trigger: 30 }, fixture,
      { ...options, now: new Date("2026-10-30T16:00:00Z"), observed: observed({ valueNative: 31, unit: "°C" }) })).to.include({ probability: 1 });
  });
  it("rejects unsupported cold and incompatible WSF2 wind forecasts", () => {
    for (const peril of ["cold", "wind"] as const) expect(forecastFromEnsemble({ ...window, peril }, fixture, options)).to.equal(null);
  });
  it("requires at least 20 complete members, retaining true zero values", () => {
    const body = copy();
    for (let member = 20; member <= 30; member++) (body.daily as Record<string, unknown>)[`precipitation_sum_member${member}`] = [null, 0, 0];
    expect(forecastFromEnsemble(window, body, options)).to.include({ membersTotal: 20 });
    (body.daily as Record<string, unknown>).precipitation_sum_member19 = [null, 0, 0];
    expect(forecastFromEnsemble(window, body, options)).to.equal(null);
  });
  it("rejects missing units, duplicate days and malformed member values", () => {
    const body = copy(); body.daily.time[1] = body.daily.time[0];
    expect(forecastFromEnsemble(window, body, options)).to.equal(null);
    expect(forecastFromEnsemble(window, { ...fixture, daily_units: {} }, options)).to.equal(null);
    expect(forecastFromEnsemble(window, {}, options)).to.equal(null);
  });
  it("converts declared imperial/metric units and rejects unknown units", () => {
    expect(ensembleNative(1, "in", "rain")).to.equal(25.4);
    expect(ensembleNative(1, "cm", "snow")).to.equal(10);
    expect(ensembleNative(86, "°F", "heat")).to.equal(30);
    expect(ensembleNative(-10, "°C", "heat")).to.equal(-10);
    expect(ensembleNative(-1, "mm", "rain")).to.equal(null);
    expect(ensembleNative(1, "unknown", "rain")).to.equal(null);
  });
  it("does not emit a forecast for a fully ended window", () => {
    expect(forecastFromEnsemble(window, fixture, { ...options, now: new Date("2026-11-03T16:00:00Z") })).to.equal(null);
  });
  it("uses pinned coordinates, model, timezone and hourly cache across trigger queries", async () => {
    let clock = now; let calls = 0;
    const reader = new ForecastExceedanceReader({ now: () => clock, fetcher: async (url) => {
      calls++;
      const query = new URL(String(url)).searchParams;
      expect(Object.fromEntries(query)).to.include({ latitude: "40.7789", longitude: "-73.9692", daily: "precipitation_sum", models: "gfs_seamless", timezone: "America/New_York", forecast_days: "35" });
      return new Response(JSON.stringify(fixture));
    } });
    const [a, b] = await Promise.all([reader.read(window), reader.read({ ...window, trigger: 4 })]);
    expect(a!.probability).not.to.equal(b!.probability); expect(calls).to.equal(1);
    clock = new Date(now.getTime() + 3_600_001);
    expect((await reader.read(window))!.fetchedAt).not.to.equal(a!.fetchedAt); expect(calls).to.equal(2);
  });
  it("reads observed progress for the exact past prefix and keeps history separate", async () => {
    const started = { ...window, start: "2026-10-29", historyProbability: 0.2 };
    const reader = new ForecastExceedanceReader({ now: () => new Date("2026-10-30T16:00:00Z"), resolveMarket: async () => started,
      readProgress: async (input) => { expect(input).to.include({ start: started.start, end: "2026-10-30" }); return observed(); },
      fetcher: async () => new Response(JSON.stringify(fixture)) });
    const result = await reader.edge("address");
    expect(result.historyProbability).to.equal(0.2); expect(result.forecast!.membersTotal).to.equal(31);
  });
  it("returns null if observation or ensemble requests fail", async () => {
    const reader = new ForecastExceedanceReader({ now: () => new Date("2026-10-30T16:00:00Z"), readProgress: async () => { throw new Error("down"); } });
    expect(await reader.read({ ...window, start: "2026-10-29" })).to.equal(null);
    for (const fetcher of [async () => new Response("unavailable", { status: 503 }), async () => { throw new Error("down"); }]) {
      expect(await new ForecastExceedanceReader({ now: () => now, fetcher }).read(window)).to.equal(null);
    }
  });
});
describe("forecast edge chip", () => {
  it("hides 4.99 points, includes 5 points, and preserves negative points", () => {
    expect(edgeChip(4.99, 0)).to.equal(null);
    expect(edgeChip(25, 20)).to.deep.equal({ points: 5, sign: "pos" });
    expect(edgeChip(8, 20)).to.deep.equal({ points: -12, sign: "neg" });
    expect(edgeChip(15, 20)).to.deep.equal({ points: -5, sign: "neg" });
    expect(edgeChip(null, 20)).to.equal(null);
    expect(edgeChip(NaN, 20)).to.equal(null);
  });
});
