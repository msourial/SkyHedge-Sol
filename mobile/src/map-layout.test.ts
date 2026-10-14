import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GLOBAL_VIEW, REGION_VIEW } from "./geo-paths.ts";
import { MARKETS } from "./markets-catalog.ts";
import { CLUSTER_HIT_DP, MAP_LABEL_PX, clusterA11yLabel, clusterWindow, clusterConcepts, globalWindow, inWin, isKey, labelBox, placeLabels, regionWindow } from "./map-layout.ts";

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

describe("cluster zoom", () => {
  const gw = globalWindow(MARKETS); const gk = gw.w / PHONE_DP;
  const { clusters } = clusterConcepts(MARKETS, false, gk);
  it("hit targets are at least 44dp", () => { assert.ok(CLUSTER_HIT_DP >= 44); });
  it("labels every cluster for screen readers", () => {
    const c = clusters[0];
    const label = clusterA11yLabel(c, MARKETS);
    assert.match(label, new RegExp(`^Group of ${c.count} cities: `));
    for (const code of c.codes) assert.ok(label.includes(MARKETS.find((m) => m.code === code)!.name));
  });
  for (const c of clusters) {
    it(`framing ${c.codes.join(",")} shows and labels its cities without overlap`, () => {
      const win = clusterWindow(MARKETS, c.codes);
      assert.ok(win.w < gw.w, "zoomed in");
      for (const code of c.codes) assert.ok(inWin(MARKETS.find((m) => m.code === code)!.globalXY, win, 8), `${code} in frame`);
      const k = win.w / PHONE_DP;
      const pins = MARKETS.filter((m) => inWin(m.globalXY, win));
      const labels = [...placeLabels(pins, false, new Set(), k, win, { labelConcepts: true, prefer: new Set(c.codes) }).values()];
      for (const L of labels) assert.ok(L.size / k >= MAP_LABEL_PX - 1e-9);
      const boxes = labels.map(labelBox);
      boxes.forEach((b, i) => {
        assert.ok(b[0] >= win.x && b[2] <= win.x + win.w && b[1] >= win.y && b[3] <= win.y + win.h);
        boxes.forEach((o, j) => { if (j > i) assert.ok(!overlap(b, o), `${labels[i].code} overlaps ${labels[j].code}`); });
      });
      const shown = c.codes.filter((code) => labels.some((L) => L.code === code)).length;
      assert.ok(shown >= Math.ceil(c.count / 2), `at least half of the cluster labelled (${shown}/${c.count})`);
    });
  }
});
