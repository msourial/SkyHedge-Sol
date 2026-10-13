import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GLOBAL_VIEW, REGION_VIEW } from "./geo-paths.ts";
import { MARKETS } from "./markets-catalog.ts";
import { MAP_LABEL_PX, clusterConcepts, globalWindow, inWin, isKey, labelBox, placeLabels, regionWindow } from "./map-layout.ts";

const PHONE_DP = 340;
const keyNA = MARKETS.filter((m) => m.group === "North America" && isKey(m));
const overlap = (a: number[], b: number[]) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

describe("map bounds", () => {
  it("every live / ready / soon North American city lies inside the projected region map", () => {
    assert.ok(keyNA.length >= 5);
    for (const m of keyNA) assert.ok(inWin(m.regionXY, { x: 0, y: 0, w: REGION_VIEW.width, h: REGION_VIEW.height }, 20), `${m.code} ${m.regionXY}`);
  });
  it("the default region view fits every key city (Miami and NYC included)", () => {
    const win = regionWindow(MARKETS, MARKETS.find((m) => m.code === "DSM"));
    for (const m of keyNA) assert.ok(inWin(m.regionXY, win, 20), `${m.code} outside region window`);
    assert.ok(win.x >= 0 && win.y >= 0 && win.x + win.w <= REGION_VIEW.width + 0.01 && win.y + win.h <= REGION_VIEW.height + 0.01);
  });
  it("the global view includes every city, Oceania included, without wrapping", () => {
    const win = globalWindow(MARKETS);
    for (const m of MARKETS) assert.ok(inWin(m.globalXY, win, 8), `${m.code} ${m.globalXY}`);
    assert.ok(win.x + win.w <= GLOBAL_VIEW.width + 0.01);
    const syd = MARKETS.find((m) => m.code === "SYD")!, akl = MARKETS.find((m) => m.code === "AKL")!;
    assert.ok(akl.globalXY[0] > syd.globalXY[0], "Auckland sits east of Sydney");
  });
});

describe("labels", () => {
  for (const scope of ["region", "global"] as const) {
    it(`${scope}: >= ${MAP_LABEL_PX}dp, inside the map, never overlapping`, () => {
      const region = scope === "region";
      const win = region ? regionWindow(MARKETS) : globalWindow(MARKETS);
      const k = win.w / PHONE_DP;
      const pins = region ? MARKETS.filter((m) => m.group === "North America" && inWin(m.regionXY, win)) : MARKETS;
      const labels = [...placeLabels(pins, region, new Set(), k, win).values()];
      assert.ok(labels.length > 0);
      for (const L of labels) assert.ok(L.size / k >= MAP_LABEL_PX);
      const boxes = labels.map(labelBox);
      boxes.forEach((b, i) => {
        assert.ok(b[0] >= win.x && b[2] <= win.x + win.w && b[1] >= win.y && b[3] <= win.y + win.h, `${labels[i].code} leaves the map`);
        boxes.forEach((o, j) => { if (j > i) assert.ok(!overlap(b, o), `${labels[i].code} overlaps ${labels[j].code}`); });
      });
      if (region) for (const code of ["DSM", "ORD", "NYC", "MIA", "YYZ"]) assert.ok(labels.some((L) => L.code === code), `${code} label shown`);
      else assert.ok(labels.some((L) => L.code === "DSM"), "Des Moines labelled globally");
    });
  }
  it("global view labels only key cities and groups concept pins", () => {
    const win = globalWindow(MARKETS); const k = win.w / PHONE_DP;
    const labels = placeLabels(MARKETS, false, new Set(), k, win);
    for (const code of labels.keys()) assert.ok(isKey(MARKETS.find((m) => m.code === code)!));
    const { singles, clusters } = clusterConcepts(MARKETS, false, k);
    assert.ok(clusters.length > 0);
    assert.equal(singles.length + clusters.reduce((n, c) => n + c.count, 0), MARKETS.filter((m) => m.status === "concept").length);
  });
});

describe("clusters", () => {
  it("cluster badges never cover a key-city pin in the global view", () => {
    const win = globalWindow(MARKETS); const k = win.w / PHONE_DP;
    const { clusters } = clusterConcepts(MARKETS, false, k);
    for (const c of clusters) for (const m of MARKETS.filter(isKey)) assert.ok(Math.hypot(m.globalXY[0] - c.x, m.globalXY[1] - c.y) > 16 * k, `cluster ${c.codes.join(",")} covers ${m.code}`);
  });
});
