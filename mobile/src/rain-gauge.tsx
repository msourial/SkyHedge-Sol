import { useId } from "react";
import Svg, { ClipPath, Defs, G, Line, Rect, Text as SvgText } from "react-native-svg";
import { C } from "./theme";

const SLICKER = "#F2C230";

/** Graduated cylinder shared with the web gauge. Water is glacier. The selected line is slicker yellow. */
export function RainGauge({ level, ticks, label, width = 72, height = 168 }: { level: number; ticks: ReadonlyArray<{ mm: number; selected?: boolean }>; label?: string; width?: number; height?: number }) {
  const clipId = useId().replace(/:/g, "");
  const max = Math.max(1, ...ticks.map((tick) => tick.mm));
  const fill = Math.min(1, Math.max(0, level));
  const waterHeight = 128 * fill;
  const waterY = 148 - waterHeight;
  return (
    <Svg width={width} height={height} viewBox="0 0 72 168" accessibilityRole="image" accessibilityLabel={label ?? "Rain gauge"}>
      <Rect x={16} y={8} width={32} height={144} rx={16} fill={C.surfaceRaised} stroke={C.border} strokeWidth={2} />
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
        return (
          <G key={tick.mm}>
            <Line x1={48} x2={tick.selected ? 64 : 58} y1={y} y2={y} stroke={tick.selected ? SLICKER : C.quiet} strokeWidth={tick.selected ? 2 : 1} />
            <SvgText x={66} y={y + 3} fill={tick.selected ? SLICKER : C.quiet} fontSize={8}>{tick.mm}</SvgText>
          </G>
        );
      })}
    </Svg>
  );
}
