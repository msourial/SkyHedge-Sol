import { expect } from "chai";
import { CoverProgressReader, parseAcisObservations, ACIS_SOURCE, CDO_SOURCE } from "./cover-progress.js";
import { parseCdoObservation } from "./ghcnd-daily.js";
import { canonicalSourceHash, NOAA_STATIONS } from "./noaa.js";
import { methodologyHashes } from "./methodology-docs.js";
import { perilCityHashHex, type PerilId } from "../../shared/perils.js";
import { weatherWindowFromAccount } from "./market-weather-window.js";

const window = { city: "new-york" as const, peril: "rain" as const, start: "2026-10-01", end: "2026-10-04" };
const now = () => new Date("2026-10-05T16:00:00Z");
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const cdo = (values: number[], dates = ["2026-10-01", "2026-10-02", "2026-10-03"], attributes = ",,,") => ({ results: values.map((value, i) => ({ date: dates[i], value, attributes })) });

describe("cover progress", () => {
  it("uses the settlement rain parser and allowed B/D/T flags", () => {
    for (const flag of ["", "B", "D", "T"]) expect(parseCdoObservation("rain", { date: "2026-10-01", value: 0, attributes: `${flag},,,` }).value).to.equal(0);
    for (const attributes of ["P,,,", "A,,,", ",X,,", "", null]) expect(() => parseCdoObservation("rain", { date: "2026-10-01", value: 1, attributes })).to.throw();
  });
  it("converts ACIS inches and traces, skips M, and preserves GHCN daily precision", () => {
    const observations = parseAcisObservations("rain", { data: [["2026-10-01", "1.00"], ["2026-10-02", "M"], ["2026-10-03", "T"], ["2026-10-04", ["0.1500", " "]], ["2026-10-05", ["0.0000", "T"]]] });
    expect(observations.map((r) => r.value)).to.deep.equal([25.4, 0, 3.8, 0]);
    expect(observations[1].measurementFlag).to.equal("T");
    expect(parseAcisObservations("snow", { data: [["2026-10-01", "1.0"]] })[0].value).to.equal(25);
    expect(parseAcisObservations("heat", { data: [["2026-10-01", "86"]] })[0].value).to.equal(30);
    expect(parseAcisObservations("heat", { data: [["2026-10-01", "14"]] })[0].value).to.equal(-10);
  });
  it("rejects malformed, estimated and suspect ACIS observations", () => {
    for (const value of [null, "", "oops", "-1", ["1", "S"], ["1", "A"]]) expect(() => parseAcisObservations("rain", { data: [["2026-10-01", value]] })).to.throw();
  });
  it("returns not_started without a network call before the window", async () => {
    const reader = new CoverProgressReader({ now: () => new Date("2026-09-30T16:00:00Z"), fetcher: async () => { throw new Error("must not fetch"); } });
    expect(await reader.read(window)).to.include({ state: "not_started", valueNative: null, daysTotal: 3, daysReported: 0 });
  });
  it("tracks mid-window with the last reported day, ignoring no missing days", async () => {
    const reader = new CoverProgressReader({ now: () => new Date("2026-10-03T16:00:00Z"), token: () => "token", fetcher: async () => json(cdo([1.2])) });
    expect(await reader.read(window)).to.include({ state: "tracking", valueNative: 1.2, daysReported: 1, observedThrough: "2026-10-01", complete: false, source: CDO_SOURCE });
  });
  for (const [peril, values, expected, unit] of [["rain", [1.2, 2.3, 0], 3.5, "mm"], ["snow", [10, 5, 0], 15, "mm"], ["wind", [8, 13.2, 9], 13.2, "m/s"], ["heat", [-3, -1, -2], -1, "°C"]] as const) {
    it(`uses settlement ${peril} aggregation and native unit`, async () => {
      const reader = new CoverProgressReader({ now, token: () => "token", fetcher: async () => json(cdo([...values])) });
      expect(await reader.read({ ...window, peril })).to.include({ state: "complete", complete: true, valueNative: expected, unit, daysReported: 3 });
    });
  }
  it("reports ended_waiting for an incomplete ended window", async () => {
    const reader = new CoverProgressReader({ now, token: () => "token", fetcher: async () => json(cdo([1])) });
    expect(await reader.read(window)).to.include({ state: "ended_waiting", valueNative: 1, complete: false });
  });
  it("never invents zero when both sources are empty or down", async () => {
    for (const fetcher of [async () => json({ data: [] }), async () => json({}, 503)]) {
      const reader = new CoverProgressReader({ now, token: () => undefined, fetcher });
      expect(await reader.read(window)).to.include({ state: "unavailable", valueNative: null, observedThrough: null, daysReported: 0 });
    }
  });
  it("returns unsupported cold and keyless WSF2 honestly", async () => {
    const reader = new CoverProgressReader({ now, token: () => undefined });
    expect(await reader.read({ ...window, peril: "cold" })).to.include({ state: "unavailable", valueNative: null, unit: "°C" });
    expect((await reader.read({ ...window, peril: "wind" })).reason).to.include("WSF2");
  });
  it("falls back on missing token or CDO HTTP failure, sends the stripped station pin", async () => {
    for (const token of [undefined, "token"]) {
      const requests: string[] = [];
      const reader = new CoverProgressReader({ now, token: () => token, fetcher: async (url, init) => {
        requests.push(String(url));
        if (String(url).includes("ncei")) return json({}, 503);
        expect(JSON.parse(String(init?.body))).to.include({ sid: "USW00094728", sdate: "2026-10-01", edate: "2026-10-03" });
        return json({ data: [["2026-10-01", "0.1"]] });
      } });
      expect(await reader.read(window)).to.include({ source: ACIS_SOURCE, valueNative: 2.5 });
      expect(requests).to.have.length(token ? 2 : 1);
    }
  });
  it("does not bypass failed CDO flags by falling back to an unflagged ACIS value", async () => {
    let calls = 0;
    const reader = new CoverProgressReader({ now, token: () => "token", fetcher: async () => { calls++; return json(cdo([2], undefined, ",X,,")); } });
    expect(await reader.read(window)).to.include({ state: "unavailable", valueNative: null });
    expect(calls).to.equal(1);
  });
  it("rejects duplicate, out-of-window, or same-day records", async () => {
    for (const dates of [["2026-10-01", "2026-10-01"], ["2026-10-01", "2026-10-04"], ["2026-10-01", "2026-10-03"]]) {
      const reader = new CoverProgressReader({ now: () => new Date("2026-10-03T16:00:00Z"), token: () => "t", fetcher: async () => json(cdo([1, 2], dates)) });
      expect(await reader.read(window)).to.include({ state: "unavailable", valueNative: null });
    }
  });
  it("shares station/element/window cache across covers, expires after one hour", async () => {
    let clock = now(); let calls = 0;
    const reader = new CoverProgressReader({ now: () => clock, token: () => "t", fetcher: async () => { calls++; return json(cdo([1, 2, 3])); } });
    const [a, b] = await Promise.all([reader.read(window), reader.read(window)]);
    expect(a).to.deep.equal(b); expect(calls).to.equal(1);
    clock = new Date(clock.getTime() + 3_600_001);
    expect((await reader.read(window)).fetchedAt).not.to.equal(a.fetchedAt); expect(calls).to.equal(2);
  });
  it("rejects invalid and excessive date ranges", async () => {
    const reader = new CoverProgressReader({ now });
    for (const bad of [{ start: "2026-02-30" }, { start: window.end }, { start: "2024-01-01" }]) {
      let threw = false; try { await reader.read({ ...window, ...bad }); } catch { threw = true; } expect(threw).to.equal(true);
    }
  });
  it("resolves rain and non-rain account hashes and checks pinned station/methodology", () => {
    for (const [city, peril] of [["new-york", "rain"], ["chicago", "snow"], ["chicago", "wind"], ["miami", "heat"]] as const) {
      const hashes = methodologyHashes(peril);
      const bytes = (hex: string) => [...Buffer.from(hex, "hex")];
      const account = { city_hash: bytes(perilCityHashHex(city, peril)), station_id_hash: bytes(canonicalSourceHash(NOAA_STATIONS[city].stationId)),
        provider_hash: bytes(hashes.providerHash), methodology_hash: bytes(hashes.methodologyHash), threshold_mm_x100: "200", operator: { GreaterThanOrEqual: {} },
        observation_start: Date.parse("2026-10-01") / 1_000, observation_end: Date.parse("2026-10-04") / 1_000, quote_probability_bps: 2000 };
      expect(weatherWindowFromAccount(account)).to.include({ city, peril, trigger: 2, operator: "gte", historyProbability: 0.2, start: window.start, end: window.end });
      expect(() => weatherWindowFromAccount({ ...account, station_id_hash: new Array(32).fill(0) })).to.throw(/pin/);
      for (const [variant, operator] of [["GreaterThan", "gt"], ["GreaterThanOrEqual", "gte"], ["LessThan", "lt"], ["LessThanOrEqual", "lte"]]) {
        expect(weatherWindowFromAccount({ ...account, operator: { [variant]: {} } }).operator).to.equal(operator);
      }
    }
  });
});
