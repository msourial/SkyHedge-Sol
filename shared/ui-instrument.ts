/**
 * One grammar, five silhouettes. Paths are shared by web SVG and Seeker SVG.
 * Scale numbers are only "0" (mm and m/s, stage size) and the selected trigger.
 */
import { fractionOnScale, scaleFor } from "./ui-ladder.ts";
import { measureLabel } from "./ui-money.ts";
import { lineTokens } from "./ui-tokens.ts";
import type { PerilId } from "./ui-types.ts";

export type InstrumentState = "loading" | "idle" | "covered" | "paid" | "dry" | "ghost";
export type InstrumentSize = "stage" | "tile" | "mini";

export type DrawOp =
  | { op: "path"; d: string; stroke?: string; fill?: string; sw?: number; cap?: "round" | "butt" }
  | { op: "rect"; x: number; y: number; w: number; h: number; rx?: number; fill?: string; stroke?: string; sw?: number }
  | { op: "circle"; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number }
  | { op: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number; cap?: "round" | "butt" }
  | { op: "text"; x: number; y: number; text: string; fill: string; size: number; anchor: "start" | "middle" | "end" };

export type InstrumentArt = {
  viewBox: string;
  width: number;
  height: number;
  ops: DrawOp[];
  /** Y of the selected trigger inside the viewBox, for the full-bleed line. */
  anchorY: number | null;
  label: string;
};

const RAIN = { w: 96, h: 248, tubeX: 8, tubeY: 4, tubeW: 64, tubeH: 220 };
const SNOW = { w: 72, h: 248, postW: 40, segH: 8, gap: 2, count: 24, baseH: 4 };
const DIAL = { w: 176, h: 176, cx: 88, cy: 88, r: 70, start: 150, sweep: 240 };
const THERM = { w: 72, h: 248, tubeX: 20, tubeY: 4, tubeW: 32, tubeH: 176, bulbR: 32, bulbCy: 210 };

export function instrumentArt(input: {
  peril: PerilId;
  rungs: readonly number[];
  selected: number | null;
  reading: number | null;
  state: InstrumentState;
  size: InstrumentSize;
  unit: string;
}): InstrumentArt {
  const ghost = input.state === "ghost";
  const loading = input.state === "loading";
  const natural = loading ? loadingArt(input.peril) : ghost ? ghostArt(input.peril) : liveArt(input);
  const scale = input.size === "tile" ? 0.55 : input.size === "mini" ? Math.min(40 / natural.width, 64 / natural.height) : 1;
  return {
    ...natural,
    width: Math.round(natural.width * scale),
    height: Math.round(natural.height * scale),
    ops: input.size === "stage" ? natural.ops : natural.ops.filter((op) => op.op !== "text"),
  };
}

function liveArt(input: {
  peril: PerilId;
  rungs: readonly number[];
  selected: number | null;
  reading: number | null;
  state: InstrumentState;
  unit: string;
}): InstrumentArt {
  const triggers = input.rungs.filter((value) => Number.isFinite(value) && value > 0);
  const scale = scaleFor(input.peril, triggers);
  const selected = input.selected != null && triggers.includes(input.selected) ? input.selected : null;
  const reading = input.reading != null && Number.isFinite(input.reading) ? Math.max(0, input.reading) : null;
  const thick = input.state === "paid" ? 6 : 2;
  if (input.peril === "snow") return snowArt(triggers, selected, reading, scale, thick, input.unit);
  if (input.peril === "wind") return windArt(triggers, selected, reading, scale, thick, input.unit);
  if (input.peril === "heat" || input.peril === "cold") return thermoArt(input.peril, triggers, selected, reading, scale, thick, input.unit);
  return rainArt(triggers, selected, reading, scale, thick, input.unit);
}

function rainArt(triggers: number[], selected: number | null, reading: number | null, scale: { min: number; max: number }, thick: number, unit: string): InstrumentArt {
  const box = RAIN;
  const ops: DrawOp[] = [];
  const innerTop = box.tubeY + 3;
  const innerH = box.tubeH - 6;
  const fill = reading == null ? 0 : fractionOnScale(reading, scale);
  if (fill > 0) {
    const h = innerH * fill;
    ops.push({ op: "rect", x: box.tubeX + 3, y: innerTop + innerH - h, w: box.tubeW - 6, h, rx: 29, fill: lineTokens.rain });
    ops.push({ op: "line", x1: box.tubeX + 6, y1: innerTop + innerH - h, x2: box.tubeX + box.tubeW - 6, y2: innerTop + innerH - h, stroke: lineTokens.meniscus, sw: 2 });
  }
  ops.push({ op: "rect", x: box.tubeX, y: box.tubeY, w: box.tubeW, h: box.tubeH, rx: 32, fill: "none", stroke: lineTokens.tick, sw: 1.5 });
  let anchor: number | null = null;
  for (const rung of triggers) {
    const y = yOn(box.tubeY, box.tubeH, fractionOnScale(rung, scale));
    const on = rung === selected;
    if (on) {
      anchor = y;
      ops.push({ op: "line", x1: 0, y1: y, x2: box.w, y2: y, stroke: lineTokens.slicker, sw: thick });
    } else {
      ops.push({ op: "line", x1: box.tubeX + box.tubeW + 4, y1: y, x2: box.tubeX + box.tubeW + 12, y2: y, stroke: lineTokens.tick, sw: 1.5 });
    }
  }
  ops.push({ op: "text", x: box.tubeX + box.tubeW / 2, y: box.h - 2, text: "0", fill: lineTokens.fg2, size: 13, anchor: "middle" });
  if (selected != null && anchor != null) {
    const label = measureLabel(selected);
    if (label) ops.push({ op: "text", x: box.tubeX + box.tubeW + 4, y: anchor - 6, text: label, fill: lineTokens.slicker, size: 13, anchor: "start" });
  }
  return { viewBox: `0 0 ${box.w} ${box.h}`, width: box.w, height: box.h, ops, anchorY: anchor, label: instrumentLabel("Rain", reading, selected, unit) };
}

function snowArt(triggers: number[], selected: number | null, reading: number | null, scale: { min: number; max: number }, thick: number, unit: string): InstrumentArt {
  const box = SNOW;
  const ops: DrawOp[] = [];
  const baseY = box.h - 16 - box.baseH;
  const postX = (box.w - box.postW) / 2;
  const lit = reading == null ? 0 : Math.max(0, Math.min(box.count, Math.floor(fractionOnScale(reading, scale) * box.count)));
  for (let index = 0; index < box.count; index += 1) {
    const y = baseY - (index + 1) * box.segH - index * box.gap;
    ops.push({ op: "rect", x: postX, y, w: box.postW, h: box.segH, fill: index < lit ? lineTokens.snow : "none", stroke: lineTokens.tick, sw: 1.5 });
  }
  ops.push({ op: "rect", x: (box.w - 56) / 2, y: baseY, w: 56, h: box.baseH, fill: lineTokens.tick });
  let anchor: number | null = null;
  for (const rung of triggers) {
    const index = Math.max(0, Math.min(box.count - 1, Math.round(fractionOnScale(rung, scale) * (box.count - 1))));
    const y = baseY - (index + 1) * box.segH - index * box.gap + box.segH / 2;
    if (rung === selected) {
      anchor = y;
      ops.push({ op: "line", x1: 0, y1: y, x2: box.w, y2: y, stroke: lineTokens.slicker, sw: thick });
    } else {
      ops.push({ op: "line", x1: postX + box.postW + 2, y1: y, x2: postX + box.postW + 10, y2: y, stroke: lineTokens.tick, sw: 1.5 });
    }
  }
  ops.push({ op: "text", x: box.w / 2, y: box.h - 2, text: "0", fill: lineTokens.fg2, size: 13, anchor: "middle" });
  if (selected != null && anchor != null) {
    const label = measureLabel(selected);
    if (label) ops.push({ op: "text", x: 4, y: Math.max(14, anchor - 8), text: label, fill: lineTokens.slicker, size: 13, anchor: "start" });
  }
  return { viewBox: `0 0 ${box.w} ${box.h}`, width: box.w, height: box.h, ops, anchorY: anchor, label: instrumentLabel("Snow", reading, selected, unit) };
}

function windArt(triggers: number[], selected: number | null, reading: number | null, scale: { min: number; max: number }, thick: number, unit: string): InstrumentArt {
  const box = DIAL;
  const ops: DrawOp[] = [];
  ops.push({ op: "path", d: arc(box.cx, box.cy, box.r, box.start, box.start + box.sweep), stroke: lineTokens.tick, fill: "none", sw: 12, cap: "round" });
  const read = reading == null ? 0 : fractionOnScale(reading, scale);
  if (read > 0) {
    ops.push({ op: "path", d: arc(box.cx, box.cy, box.r, box.start, box.start + box.sweep * read), stroke: lineTokens.wind, fill: "none", sw: 12, cap: "round" });
  }
  let anchor: number | null = null;
  for (const rung of triggers) {
    const angle = box.start + box.sweep * fractionOnScale(rung, scale);
    const inner = polar(box.cx, box.cy, box.r - 4, angle);
    const outer = polar(box.cx, box.cy, box.r + 4, angle);
    if (rung === selected) {
      const farIn = polar(box.cx, box.cy, box.r - 18, angle);
      const farOut = polar(box.cx, box.cy, box.r + 18, angle);
      anchor = farOut.y;
      ops.push({ op: "line", x1: farIn.x, y1: farIn.y, x2: farOut.x, y2: farOut.y, stroke: lineTokens.slicker, sw: thick, cap: "round" });
    } else {
      ops.push({ op: "line", x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, stroke: lineTokens.tick, sw: 1.5 });
    }
  }
  const needle = polar(box.cx, box.cy, box.r - 16, box.start + box.sweep * read);
  ops.push({ op: "line", x1: box.cx, y1: box.cy, x2: needle.x, y2: needle.y, stroke: lineTokens.fg, sw: 3, cap: "round" });
  ops.push({ op: "circle", cx: box.cx, cy: box.cy, r: 6, fill: lineTokens.fg });
  ops.push({ op: "text", x: 28, y: 168, text: "0", fill: lineTokens.fg2, size: 13, anchor: "middle" });
  if (selected != null) {
    const label = measureLabel(selected);
    if (label) ops.push({ op: "text", x: box.cx, y: 24, text: label, fill: lineTokens.slicker, size: 13, anchor: "middle" });
  }
  return { viewBox: `0 0 ${box.w} ${box.h}`, width: box.w, height: box.h, ops, anchorY: anchor, label: instrumentLabel("Wind", reading, selected, unit) };
}

function thermoArt(peril: "heat" | "cold", triggers: number[], selected: number | null, reading: number | null, scale: { min: number; max: number }, thick: number, unit: string): InstrumentArt {
  const box = THERM;
  const ops: DrawOp[] = [];
  const tint = peril === "heat" ? lineTokens.heat : lineTokens.cold;
  const fill = reading == null ? 0 : fractionOnScale(reading, scale);
  ops.push({ op: "circle", cx: box.w / 2, cy: box.bulbCy, r: box.bulbR, fill: fill > 0 ? tint : "none", stroke: lineTokens.tick, sw: 1.5 });
  ops.push({ op: "rect", x: box.tubeX, y: box.tubeY, w: box.tubeW, h: box.tubeH, rx: 16, fill: "none", stroke: lineTokens.tick, sw: 1.5 });
  if (fill > 0) {
    const h = (box.tubeH - 8) * fill;
    const y = peril === "cold" ? box.tubeY + 4 : box.tubeY + box.tubeH - 4 - h;
    ops.push({ op: "rect", x: box.tubeX + 4, y, w: box.tubeW - 8, h, rx: 12, fill: tint });
  }
  let anchor: number | null = null;
  for (const rung of triggers) {
    const y = yOn(box.tubeY, box.tubeH, fractionOnScale(rung, scale));
    if (rung === selected) {
      anchor = y;
      ops.push({ op: "line", x1: 0, y1: y, x2: box.w, y2: y, stroke: lineTokens.slicker, sw: thick });
    } else {
      ops.push({ op: "line", x1: box.tubeX + box.tubeW + 4, y1: y, x2: box.tubeX + box.tubeW + 12, y2: y, stroke: lineTokens.tick, sw: 1.5 });
    }
  }
  if (selected != null && anchor != null) {
    const label = measureLabel(selected);
    if (label) ops.push({ op: "text", x: box.tubeX + box.tubeW + 4, y: anchor - 6, text: label, fill: lineTokens.slicker, size: 13, anchor: "start" });
  }
  return { viewBox: `0 0 ${box.w} ${box.h}`, width: box.w, height: box.h, ops, anchorY: anchor, label: instrumentLabel(peril === "heat" ? "Heat" : "Cold", reading, selected, unit) };
}

function ghostArt(peril: PerilId): InstrumentArt {
  if (peril === "wind") {
    const box = DIAL;
    return {
      viewBox: `0 0 ${box.w} ${box.h}`, width: box.w, height: box.h, anchorY: null,
      label: "Wind, not open",
      ops: [{ op: "path", d: arc(box.cx, box.cy, box.r, box.start, box.start + box.sweep), stroke: lineTokens.tick, fill: "none", sw: 12, cap: "round" }, { op: "circle", cx: box.cx, cy: box.cy, r: 6, fill: "none", stroke: lineTokens.tick, sw: 1.5 }],
    };
  }
  if (peril === "snow") {
    const box = SNOW;
    const baseY = box.h - 16 - box.baseH;
    const postX = (box.w - box.postW) / 2;
    const ops: DrawOp[] = [];
    for (let index = 0; index < box.count; index += 1) {
      const y = baseY - (index + 1) * box.segH - index * box.gap;
      ops.push({ op: "rect", x: postX, y, w: box.postW, h: box.segH, fill: "none", stroke: lineTokens.tick, sw: 1.5 });
    }
    ops.push({ op: "rect", x: (box.w - 56) / 2, y: baseY, w: 56, h: box.baseH, fill: "none", stroke: lineTokens.tick, sw: 1.5 });
    return { viewBox: `0 0 ${box.w} ${box.h}`, width: box.w, height: box.h, ops, anchorY: null, label: "Snow, not open" };
  }
  if (peril === "heat" || peril === "cold") {
    const box = THERM;
    return {
      viewBox: `0 0 ${box.w} ${box.h}`, width: box.w, height: box.h, anchorY: null,
      label: `${peril === "heat" ? "Heat" : "Cold"}, not open`,
      ops: [
        { op: "circle", cx: box.w / 2, cy: box.bulbCy, r: box.bulbR, fill: "none", stroke: lineTokens.tick, sw: 1.5 },
        { op: "rect", x: box.tubeX, y: box.tubeY, w: box.tubeW, h: box.tubeH, rx: 16, fill: "none", stroke: lineTokens.tick, sw: 1.5 },
      ],
    };
  }
  const box = RAIN;
  return {
    viewBox: `0 0 ${box.w} ${box.h}`, width: box.w, height: box.h, anchorY: null, label: "Rain, not open",
    ops: [{ op: "rect", x: box.tubeX, y: box.tubeY, w: box.tubeW, h: box.tubeH, rx: 32, fill: "none", stroke: lineTokens.tick, sw: 1.5 }],
  };
}

function loadingArt(peril: PerilId): InstrumentArt {
  const ghost = ghostArt(peril);
  return { ...ghost, label: "Loading", ops: [{ op: "rect", x: 8, y: 8, w: ghost.width - 16, h: ghost.height - 16, rx: 28, fill: lineTokens.surface2 }] };
}

function instrumentLabel(name: string, reading: number | null, selected: number | null, unit: string): string {
  const seen = measureLabel(reading ?? 0) ?? "0";
  const trigger = selected == null ? null : measureLabel(selected);
  return trigger ? `${name}: ${seen} of ${trigger} ${unit}` : `${name}: ${seen} ${unit}`;
}

function yOn(top: number, height: number, fractionFromBottom: number): number {
  return top + height * (1 - fractionFromBottom);
}

function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arc(cx: number, cy: number, r: number, start: number, end: number): string {
  const a = polar(cx, cy, r, start);
  const b = polar(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${round(a.x)} ${round(a.y)} A ${r} ${r} 0 ${large} 1 ${round(b.x)} ${round(b.y)}`;
}

function round(value: number): string {
  return (Math.round(value * 10) / 10).toString();
}
