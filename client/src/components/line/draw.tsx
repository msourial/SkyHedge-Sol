import type { DrawOp } from "../../../../shared/ui-instrument.ts";
import { lineTokens } from "../../../../shared/ui-tokens.ts";

const FILL_COLORS = new Set<string>([lineTokens.rain, lineTokens.snow, lineTokens.wind, lineTokens.heat, lineTokens.cold, lineTokens.meniscus]);

export function LineArt({ ops, viewBox, label, width, height }: { ops: DrawOp[]; viewBox: string; label: string; width: number; height: number }) {
  const triggerLine = ops.find((op) => op.op === "line" && op.stroke === lineTokens.slicker);
  return (
    <svg className="ln-art" viewBox={viewBox} width={width} height={height} role="img" aria-label={label}>
      {ops.map((op, index) => {
        if (op === triggerLine) return null;
        const fillClass = op.op !== "text" && "fill" in op && op.fill && FILL_COLORS.has(op.fill) ? "ln-fill" : undefined;
        if (op.op === "path") return <path key={index} className={op.stroke === lineTokens.slicker ? "ln-rule-stroke" : fillClass} d={op.d} stroke={op.stroke} fill={op.fill ?? "none"} strokeWidth={op.sw} strokeLinecap={op.cap} />;
        if (op.op === "rect") return <rect key={index} className={fillClass} x={op.x} y={op.y} width={op.w} height={op.h} rx={op.rx} fill={op.fill ?? "none"} stroke={op.stroke} strokeWidth={op.sw} />;
        if (op.op === "circle") return <circle key={index} className={fillClass} cx={op.cx} cy={op.cy} r={op.r} fill={op.fill ?? "none"} stroke={op.stroke} strokeWidth={op.sw} />;
        if (op.op === "line") return <line key={index} x1={op.x1} y1={op.y1} x2={op.x2} y2={op.y2} stroke={op.stroke} strokeWidth={op.sw} strokeLinecap={op.cap} />;
        return <text key={index} x={op.x} y={op.y} fill={op.fill} fontSize={op.size} textAnchor={op.anchor} fontFamily="IBM Plex Mono, ui-monospace, monospace">{op.text}</text>;
      })}
      {triggerLine?.op === "line" ? <line className="ln-moving-trigger" x1="0" y1="0" x2={Math.hypot(triggerLine.x2 - triggerLine.x1, triggerLine.y2 - triggerLine.y1)} y2="0" stroke={triggerLine.stroke} strokeWidth={triggerLine.sw} strokeLinecap={triggerLine.cap} style={{ transform: `translate(${triggerLine.x1}px, ${triggerLine.y1}px) rotate(${Math.atan2(triggerLine.y2 - triggerLine.y1, triggerLine.x2 - triggerLine.x1) * 180 / Math.PI}deg)` }}/> : null}
    </svg>
  );
}
