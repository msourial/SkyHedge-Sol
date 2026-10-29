/** Shared draw operations consumed unchanged by SVG on web and Seeker. */
import { fractionOnScale, scaleFor } from "./ui-ladder.ts";
import { lineTokens } from "./ui-tokens.ts";
import { instrumentDescription, zeroLabel } from "./ui-copy.ts";
import type { PerilId } from "./ui-types.ts";

export type InstrumentState = "loading" | "idle" | "covered" | "paid" | "dry" | "ghost";
export type InstrumentSize = "hero" | "stage" | "tile" | "mini";

export type DrawOp =
  | { op: "path"; d: string; stroke?: string; fill?: string; sw?: number; cap?: "round" | "butt" }
  | { op: "rect"; x: number; y: number; w: number; h: number; rx?: number; fill?: string; stroke?: string; sw?: number }
  | { op: "circle"; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number }
  | { op: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number; cap?: "round" | "butt" }
  | { op: "text"; x: number; y: number; text: string; fill: string; size: number; anchor: "start" | "middle" | "end" };

export const lineEndX = 96;
export const HERO_LINE_END_X = lineEndX;
export type InstrumentArt = {
  viewBox: string;
  width: number;
  height: number;
  ops: DrawOp[];
  /** Selected trigger in the instrument's coordinates. Never a page-wide rule. */
  anchorY: number | null;
  lineEndX: number;
  label: string;
};

type InstrumentInput = {
  peril: PerilId;
  rungs: readonly number[];
  selected: number | null;
  reading: number | null;
  state: InstrumentState;
  size: InstrumentSize;
  unit: string;
};

export function instrumentArt(input: InstrumentInput): InstrumentArt {
  const { peril, unit } = input;
  const wind = peril === "wind";
  const ops: DrawOp[] = [];
  const art: InstrumentArt = {
    viewBox: wind ? "-16 0 120 156" : "0 0 104 156", width: wind ? 120 : 104, height: 156,
    ops, anchorY: null, lineEndX,
    label: instrumentDescription(peril, input.reading, input.selected, unit, input.state),
  };
  // A dead selection is represented by a panel, never an empty instrument.
  if (input.state === "ghost") {
    if (input.size === "stage" || input.size === "hero") return { ...art, width: 0, height: 0 };
    // Compatibility for existing discovery empty states, migrated in later jobs.
    return { ...art, width: 40, height: 64, ops: [{ op: "rect", x: 16, y: 0, w: 56, h: 136, rx: 28, fill: "none", stroke: lineTokens.tick, sw: 1.5 }] };
  }
  if (input.state === "loading") {
    ops.push({ op: "rect", x: 16, y: 0, w: 56, h: 136, rx: 28, fill: lineTokens.surface2 });
  } else {
    const triggers = [...new Set(input.rungs.filter(Number.isFinite))].sort((a, b) => a - b);
    const scale = scaleFor(peril, triggers);
    const selected = input.selected != null && triggers.includes(input.selected) ? input.selected : null;
    const reading = input.reading != null && Number.isFinite(input.reading) ? input.reading : null;
    const fraction = reading == null ? null : fractionOnScale(reading, scale);
    const yFor = (value: number) => 136 * (1 - fractionOnScale(value, scale));
    const tint = lineTokens[peril];
    if (wind) {
      // 112dp dial including its 8dp stroke, centred vertically in 136dp.
      const cx = 44, cy = 68, radius = 52;
      ops.push({ op: "path", d: arc(cx, cy, radius, 150, 390), stroke: lineTokens.tick, fill: "none", sw: 8, cap: "butt" });
      if (fraction != null && fraction > 0) ops.push({ op: "path", d: arc(cx, cy, radius, 150, 150 + 240 * fraction), stroke: tint, fill: "none", sw: 8, cap: "butt" });
      for (const trigger of triggers) {
        const angle = 150 + 240 * fractionOnScale(trigger, scale);
        const inside = polar(cx, cy, 38, angle), outside = polar(cx, cy, 50, angle);
        const on = trigger === selected;
        ops.push({ op: "line", x1: inside.x, y1: inside.y, x2: outside.x, y2: outside.y, stroke: on ? lineTokens.slicker : lineTokens.tick, sw: on ? 2 : 1.5, cap: "butt" });
        if (on) art.anchorY = outside.y;
      }
      if (fraction != null) {
        const needle = polar(cx, cy, 42, 150 + 240 * fraction);
        ops.push({ op: "line", x1: cx, y1: cy, x2: needle.x, y2: needle.y, stroke: lineTokens.fg, sw: 2 });
        ops.push({ op: "circle", cx, cy, r: 4, fill: lineTokens.fg });
      }
    } else {
      let tickRight = 68;
      if (peril === "snow") {
        // Twelve 8dp segments separated by 3dp, on a 56x4 plate.
        const lit = fraction == null ? 0 : Math.floor(fraction * 12);
        for (let index = 0; index < 12; index++) ops.push({ op: "rect", x: 24, y: 129 - index * 11 - 8, w: 40, h: 8, fill: index < lit ? tint : "none", stroke: lineTokens.tick, sw: 1.5 });
        ops.push({ op: "rect", x: 16, y: 132, w: 56, h: 4, fill: lineTokens.tick });
        tickRight = 62;
      } else {
        const thermal = peril === "heat" || peril === "cold";
        const x = thermal ? 28 : 16, w = thermal ? 32 : 56;
        ops.push({ op: "rect", x, y: 0, w, h: 136, rx: w / 2, fill: "none", stroke: lineTokens.tick, sw: 1.5 });
        if (fraction != null && fraction > 0) {
          const h = 130 * fraction;
          ops.push({ op: "rect", x: x + 3, y: 133 - h, w: w - 6, h, rx: (w - 6) / 2, fill: tint });
        }
        if (thermal) {
          ops.push({ op: "circle", cx: 44, cy: 116, r: 20, fill: fraction != null ? tint : "none", stroke: lineTokens.tick, sw: 1.5 });
          tickRight = 57;
        }
      }
      for (const trigger of triggers) {
        const y = yFor(trigger);
        if (trigger === selected) {
          art.anchorY = y;
          ops.push({ op: "line", x1: 8, y1: y, x2: lineEndX, y2: y, stroke: lineTokens.slicker, sw: 2, cap: "butt" });
          // The cap ends at 96 as well; its paint cannot enter the text column.
          ops.push({ op: "rect", x: lineEndX - 6, y: y - 3, w: 6, h: 6, fill: lineTokens.slicker });
        } else ops.push({ op: "line", x1: tickRight - 12, y1: y, x2: tickRight, y2: y, stroke: lineTokens.tick, sw: 1.5 });
      }
    }
    ops.push({ op: "text", x: 44, y: 152, text: zeroLabel(unit), fill: lineTokens.fg2, size: 13, anchor: "middle" });
  }
  const sizeScale = input.size === "tile" ? 0.75 : input.size === "mini" ? Math.min(40 / art.width, 64 / art.height) : 1;
  return { ...art, width: Math.round(art.width * sizeScale), height: Math.round(art.height * sizeScale),
    ops: input.size === "stage" || input.size === "hero" ? ops : ops.filter((op) => op.op !== "text") };
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = deg * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function arc(cx: number, cy: number, r: number, start: number, end: number): string {
  const a = polar(cx, cy, r, start), b = polar(cx, cy, r, end);
  const round = (value: number) => Math.round(value * 100) / 100;
  return `M ${round(a.x)} ${round(a.y)} A ${r} ${r} 0 ${end - start > 180 ? 1 : 0} 1 ${round(b.x)} ${round(b.y)}`;
}
