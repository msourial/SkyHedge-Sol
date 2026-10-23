import { useId } from "react";
import Svg, { ClipPath, Defs, G, Line, Rect, Text as SvgText } from "react-native-svg";
import { C, F } from "./theme";

/** Graduated cylinder shared with the web gauge. Empty tube is dry-fill. Water is glacier. The selected line is slicker. */
export function RainGauge({ level, ticks, label, width = 72, height = 168, showMm = false, maxMm }: { level: number; ticks: ReadonlyArray<{ mm: number; selected?: boolean; labelled?: boolean }>; label?: string; width?: number; height?: number; showMm?: boolean; maxMm?: number }) {
  const clipId = useId().replace(/:/g, "");
  const max = Math.max(1, maxMm ?? 0, ...ticks.map((tick) => tick.mm));
  const fill = Math.min(1, Math.max(0, level));
  const waterHeight = 128 * fill;
  const waterY = 148 - waterHeight;
  const labels = ticks.filter((tick) => tick.labelled !== false).map((tick) => (showMm ? `${tick.mm} mm` : String(tick.mm)));
  const longest = labels.reduce((count, value) => Math.max(count, value.length), 0);
  const textX = 70;
  const box = Math.max(showMm ? 132 : 72, longest === 0 ? 0 : textX + longest * 8 + 12);
  const displayWidth = longest > 0 ? Math.max(width, Math.ceil(box * (height / 168))) : width;
  return (
    <Svg width={displayWidth} height={height} viewBox={`0 0 ${box} 168`} accessibilityRole="image" accessibilityLabel={label ?? "Rain gauge"}>
      <Rect x={16} y={8} width={32} height={144} rx={16} fill={C.dryFill} stroke={C.tick} strokeWidth={1.5} />
      <Defs>
        <ClipPath id={clipId}>
          <Rect x={20} y={16} width={24} height={132} rx={12} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <Rect x={20} y={waterY} width={24} height={waterHeight} fill={C.rain} />
      </G>
      {ticks.map((tick) => {
        const y = 148 - 128 * (tick.mm / max);
        const showLabel = tick.labelled !== false;
        const miniTrigger = tick.selected && tick.labelled === false;
        const x2 = tick.selected ? 62 : showLabel ? 58 : 56;
        return (
          <G key={tick.mm}>
            <Line x1={miniTrigger ? 22 : 48} x2={miniTrigger ? 42 : x2} y1={y} y2={y} stroke={tick.selected ? C.payout : C.tick} strokeWidth={miniTrigger ? 3 : tick.selected ? 2 : 1.5} vectorEffect={miniTrigger ? "non-scaling-stroke" : undefined} />
            {showLabel ? <SvgText x={textX} y={y + 4} fill={tick.selected ? C.payout : C.quiet} fontSize={11} fontFamily={F.mono}>{showMm ? `${tick.mm} mm` : tick.mm}</SvgText> : null}
          </G>
        );
      })}
    </Svg>
  );
}
