import test from "node:test";
import assert from "node:assert/strict";
import { GROUP_ORDER, MARKETS, searchMarkets, groupCounts, highlightParts, isTradable, marketByCode } from "./markets-catalog.ts";

test("Des Moines is the only live, tradable market", () => {
  const live = MARKETS.filter((m) => m.status === "live");
  assert.deepEqual(live.map((m) => m.code), ["DSM"]);
  assert.equal(MARKETS.filter(isTradable).length, 1);
});

test("Toronto Pearson stays Opens soon", () => {
  assert.equal(marketByCode("YYZ")?.status, "soon");
});

test("all requested concept markets are present exactly once with real coordinates", () => {
  const want = "MSP STL SDF DTW DEN DFW ATL YOW YUL YHZ YVR YYC YEG YXE YQR YWG MEX BOG LIM EZE GRU GIG BSB LOS ACC NBO JNB DXB RUH BOM DEL BLR DAC SGN MNL CGK".split(" ");
  for (const code of want) {
    const ms = MARKETS.filter((m) => m.code === code);
    assert.equal(ms.length, 1, code);
    assert.equal(ms[0].status, "concept", code);
    assert.ok(Math.abs(ms[0].lat) <= 90 && Math.abs(ms[0].lon) <= 180, code);
    assert.ok(ms[0].source.length > 0, code);
  }
  const added = "MCI OMA MEM LBB FAT PHX YQB YYT SCL UIO REC CAI CMN ADD DAR KHI CCU MAA CMB BKK KUL LHR CDG MAD FRA IST HND ICN TPE SYD AKL".split(" ");
  for (const code of added) assert.equal(MARKETS.filter((m) => m.code === code && m.status === "concept").length, 1, code);
  assert.equal(MARKETS.length, want.length + added.length + 5);
  assert.equal(new Set(MARKETS.map((m) => m.code)).size, MARKETS.length);
});

test("Ready to open = NOAA station already in the pipeline, still not tradable", () => {
  const ready = MARKETS.filter((m) => m.status === "ready");
  assert.deepEqual(ready.map((m) => m.code).sort(), ["MIA", "NYC", "ORD"]);
  for (const m of ready) { assert.match(m.station ?? "", /^GHCND:USW\d{8}$/); assert.equal(isTradable(m), false); assert.equal(m.source, "NOAA"); }
  assert.equal(MARKETS.filter((m) => m.station).length, 4);
});

test("every group has markets and group filter works", () => {
  for (const g of GROUP_ORDER) assert.ok(MARKETS.some((m) => m.group === g), g);
  assert.ok(searchMarkets("", "all", "Europe").every((m) => m.group === "Europe"));
  assert.equal(searchMarkets("", "all", "Oceania").length, 2);
});

test("search is accent-insensitive and ranks live first", () => {
  assert.equal(searchMarkets("sao")[0].code, "GRU");
  assert.equal(searchMarkets("tor")[0].code, "YYZ");
  assert.equal(searchMarkets("")[0].code, "DSM");
  assert.ok(searchMarkets("bra", "region").every((m) => m.group === "North America"));
});

test("group counts cover every market and highlight splits correctly", () => {
  assert.equal(groupCounts().reduce((n, g) => n + g.count, 0), MARKETS.length);
  assert.deepEqual(highlightParts("Toronto Pearson", "tor"), ["", "Tor", "onto Pearson"]);
});
