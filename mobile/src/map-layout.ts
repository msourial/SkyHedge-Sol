/** Pure layout for the Markets radar map: viewport fitting, label placement, concept clustering. No React. */
import { GLOBAL_VIEW, REGION_VIEW } from "./geo-paths.ts";
import type { CatalogMarket } from "./markets-catalog.ts";

export type Win = { x: number; y: number; w: number; h: number };
export type Label = { code: string; x: number; y: number; anchor: "start" | "middle" | "end"; size: number; text: string; leader?: { x1: number; y1: number; x2: number; y2: number } };
export type Cluster = { x: number; y: number; count: number; codes: string[] };
type Box = [number, number, number, number];

/** Minimum on-device label size in dp (matches the type-scale caption floor). */
export const MAP_LABEL_PX = 12;
export const MAP_ASPECT_REGION = 3 / 2;
export const MAP_ASPECT_GLOBAL = 2;

export const isKey = (m: CatalogMarket) => m.status === "live" || m.status === "ready" || m.status === "soon";
const xy = (m: CatalogMarket, region: boolean) => (region ? m.regionXY : m.globalXY);

/** Smallest window of the given aspect containing `pts` plus padding, kept inside `bounds`. */
export function fitWindow(pts: ReadonlyArray<readonly [number, number]>, aspect: number, pad: number, bounds: { width: number; height: number }, minW = 0): Win {
  if (!pts.length) return { x: 0, y: 0, w: bounds.width, h: Math.min(bounds.height, bounds.width / aspect) };
  let x0 = Math.min(...pts.map((p) => p[0])) - pad, x1 = Math.max(...pts.map((p) => p[0])) + pad;
  let y0 = Math.min(...pts.map((p) => p[1])) - pad, y1 = Math.max(...pts.map((p) => p[1])) + pad;
  let w = Math.max(x1 - x0, minW), h = y1 - y0;
  if (w / h < aspect) w = h * aspect; else h = w / aspect;
  if (w > bounds.width) { w = bounds.width; h = w / aspect; }
  if (h > bounds.height) { h = bounds.height; w = h * aspect; }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const x = Math.min(bounds.width - w, Math.max(0, cx - w / 2));
  const y = Math.min(bounds.height - h, Math.max(0, cy - h / 2));
  return { x, y, w, h };
}

/** Region view: fits every live / ready / soon North American city (plus the focus, if it is North American). */
export function regionWindow(markets: readonly CatalogMarket[], focus?: CatalogMarket): Win {
  const pts = markets.filter((m) => m.group === "North America" && (isKey(m) || m.code === focus?.code)).map((m) => m.regionXY);
  return fitWindow(pts, MAP_ASPECT_REGION, 70, REGION_VIEW, 600);
}

/** Global view: fits every catalogue city, Oceania included. */
export function globalWindow(markets: readonly CatalogMarket[]): Win {
  return fitWindow(markets.map((m) => m.globalXY), MAP_ASPECT_GLOBAL, 34, GLOBAL_VIEW);
}

export const inWin = (p: readonly [number, number], w: Win, inset = 0) => p[0] >= w.x + inset && p[0] <= w.x + w.w - inset && p[1] >= w.y + inset && p[1] <= w.y + w.h - inset;
const overlaps = (a: Box, b: Box) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

/** Groups concept pins that would sit within `cellPx` of each other on screen. Key markets are never clustered. */
export function clusterConcepts(pins: readonly CatalogMarket[], region: boolean, k: number, cellPx = 26): { singles: CatalogMarket[]; clusters: Cluster[] } {
  const cell = cellPx * k;
  const buckets = new Map<string, CatalogMarket[]>();
  for (const m of pins) {
    if (m.status !== "concept") continue;
    const [x, y] = xy(m, region);
    const key = `${Math.floor(x / cell)}:${Math.floor(y / cell)}`;
    buckets.set(key, [...(buckets.get(key) ?? []), m]);
  }
  const singles: CatalogMarket[] = [], clusters: Cluster[] = [];
  for (const list of buckets.values()) {
    if (list.length === 1) { singles.push(list[0]); continue; }
    const cx = list.reduce((s, m) => s + xy(m, region)[0], 0) / list.length;
    const cy = list.reduce((s, m) => s + xy(m, region)[1], 0) / list.length;
    clusters.push({ x: cx, y: cy, count: list.length, codes: list.map((m) => m.code) });
  }
  // A cluster badge never covers a key-city pin: nudge it to the nearest clear spot (badge only; pins keep true positions).
  const keys = pins.filter(isKey).map((m) => xy(m, region));
  const clearOf = (x: number, y: number) => keys.every(([kx, ky]) => Math.hypot(kx - x, ky - y) > 16 * k);
  for (const c of clusters) {
    if (clearOf(c.x, c.y)) continue;
    for (let step = 1; step <= 4; step++) {
      const hit = Array.from({ length: 8 }, (_, i) => [c.x + Math.cos((i * Math.PI) / 4) * step * 10 * k, c.y + Math.sin((i * Math.PI) / 4) * step * 10 * k]).find(([x, y]) => clearOf(x, y));
      if (hit) { c.x = hit[0]; c.y = hit[1]; break; }
    }
  }
  return { singles, clusters };
}

/**
 * Greedy placement in screen-consistent units (k = map units per dp). Priority: live, highlighted, soon, ready, concept.
 * Tries 8 slots per pin; a label that collides with a pin, another label, an `avoid` box or the map edge is hidden, never forced.
 * Global view labels key / highlighted cities only.
 */
export function placeLabels(pins: readonly CatalogMarket[], region: boolean, highlight: ReadonlySet<string>, k: number, win: Win, opts: { avoid?: Box[]; obstacles?: Box[]; labelConcepts?: boolean; prefer?: ReadonlySet<string> } = {}): Map<string, Label> {
  const pri = (m: CatalogMarket) => (m.status === "live" ? 0 : opts.prefer?.has(m.code) ? 0.5 : highlight.has(m.code) ? 1 : m.status === "soon" ? 2 : m.status === "ready" ? 3 : 4);
  const pinBox = (m: CatalogMarket): Box => { const [x, y] = xy(m, region); const r = 6 * k; return [x - r, y - r, x + r, y + r]; };
  // Key labels must clear key pins, other labels and avoid boxes; small concept pins under a key label are hidden by the renderer instead.
  const boxes: Box[] = [...(opts.obstacles ?? []), ...(opts.avoid ?? []), ...pins.filter((m) => isKey(m) || highlight.has(m.code)).map(pinBox)];
  const conceptBoxes: Box[] = pins.filter((m) => !isKey(m) && !highlight.has(m.code)).map(pinBox);
  const out = new Map<string, Label>();
  const edge = 4 * k;
  for (const m of [...pins].sort((a, b) => pri(a) - pri(b))) {
    const key = isKey(m) || highlight.has(m.code);
    if (!region && !key && !opts.labelConcepts) continue;
    const text = key ? m.short : m.code;
    const size = MAP_LABEL_PX * k;
    const w = text.length * size * 0.62, h = size;
    const [px, py] = xy(m, region);
    const g = 8 * k, base = size * 0.35; // baseline offset so text is vertically centred on y
    const slots: Array<[number, number, Label["anchor"]]> = [
      [px + g, py + base, "start"], [px - g, py + base, "end"],
      [px, py - g, "middle"], [px, py + g + h * 0.8, "middle"],
      [px + g * 0.7, py - g * 0.7, "start"], [px - g * 0.7, py - g * 0.7, "end"],
      [px + g * 0.7, py + g * 0.7 + h * 0.8, "start"], [px - g * 0.7, py + g * 0.7 + h * 0.8, "end"],
    ];
    // Callouts: key cities that can't fit beside their pin get a label further out with a leader line.
    const far = 30 * k;
    if (key) slots.push([px, py - far, "middle"], [px, py + far + h * 0.8, "middle"], [px - far * 0.8, py - far * 0.8, "end"], [px + far * 0.8, py - far * 0.8, "start"], [px - far * 0.8, py + far * 0.8 + h * 0.8, "end"], [px + far * 0.8, py + far * 0.8 + h * 0.8, "start"]);
    for (const [i, [x, y, anchor]] of slots.entries()) {
      const x0 = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
      const b: Box = [x0, y - h * 0.85, x0 + w, y + h * 0.2];
      if (b[0] < win.x + edge || b[2] > win.x + win.w - edge || b[1] < win.y + edge || b[3] > win.y + win.h - edge) continue;
      if (boxes.some((o) => overlaps(b, o))) continue;
      if (!key && conceptBoxes.some((o) => overlaps(b, o) && !(o[0] === px - 6 * k && o[1] === py - 6 * k))) continue;
      boxes.push(b);
      const leader = i >= 8 ? { x1: px, y1: py, x2: anchor === "middle" ? x : anchor === "end" ? x + 2 * k : x - 2 * k, y2: y < py ? y + h * 0.25 : y - h * 0.9 } : undefined;
      if (leader) boxes.push([Math.min(leader.x1, leader.x2) - k, Math.min(leader.y1, leader.y2), Math.max(leader.x1, leader.x2) + k, Math.max(leader.y1, leader.y2)]);
      out.set(m.code, { code: m.code, x, y, anchor, size, text, leader });
      break;
    }
  }
  return out;
}

/** Bounding box of a placed label, in map units (for tests and debug overlays). */
export function labelBox(L: Label): Box {
  const w = L.text.length * L.size * 0.62;
  const x0 = L.anchor === "start" ? L.x : L.anchor === "end" ? L.x - w : L.x - w / 2;
  return [x0, L.y - L.size * 0.85, x0 + w, L.y + L.size * 0.2];
}

/** Minimum tap target for a cluster badge, in dp. */
export const CLUSTER_HIT_DP = 44;

/** Global-projection window framing one cluster's cities (2:1, padded, never tighter than ~1/5 of the world). */
export function clusterWindow(markets: readonly CatalogMarket[], codes: readonly string[]): Win {
  const pts = markets.filter((m) => codes.includes(m.code)).map((m) => m.globalXY);
  return fitWindow(pts, MAP_ASPECT_GLOBAL, 40, GLOBAL_VIEW, 200);
}

/** "Group of 3 cities: Lagos, Accra, Nairobi. Tap to zoom in." */
export function clusterA11yLabel(c: Cluster, markets: readonly CatalogMarket[]): string {
  const names = c.codes.map((code) => markets.find((m) => m.code === code)?.name ?? code);
  return `Group of ${c.count} cities: ${names.join(", ")}. Tap to zoom in.`;
}
