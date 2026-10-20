import { useId } from "react";

type GaugeTick = { id: string; fraction: number; label: string; selected?: boolean };

/** Graduated cylinder. Water is glacier blue. The selected trigger is slicker yellow. */
export function RainGauge({ level, ticks, label, rising = true, labelled = false }: { level: number; ticks: GaugeTick[]; label?: string; rising?: boolean; labelled?: boolean }) {
  const clipId = useId().replace(/:/g, "");
  const fill = Math.min(1, Math.max(0, level));
  const waterHeight = 128 * fill;
  const waterY = 148 - waterHeight;
  const width = labelled ? 132 : 72;
  return (
    <svg className={labelled ? "rain-gauge rain-gauge--ladder" : "rain-gauge"} viewBox={`0 0 ${width} 168`} role="img" aria-label={label ?? "Rain gauge"} data-rising={rising ? "true" : "false"}>
      <rect x="16" y="8" width="32" height="144" rx="16" fill="#1C2433" stroke="#2A3444" strokeWidth="2" />
      <clipPath id={clipId}>
        <rect x="20" y="16" width="24" height="132" rx="12" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <rect className="rain-gauge__water" x="20" y={waterY} width="24" height={waterHeight} fill="#7CC4FF" />
      </g>
      {ticks.map((tick) => {
        const y = 148 - 128 * Math.min(1, Math.max(0, tick.fraction));
        return (
          <g key={tick.id}>
            <line x1="48" x2={tick.selected ? 64 : 58} y1={y} y2={y} stroke={tick.selected ? "#F2C230" : "#98A3B0"} strokeWidth={tick.selected ? 2 : 1} />
            <text x={labelled ? 70 : 66} y={y + 3} fill={tick.selected ? "#F2C230" : "#98A3B0"} fontSize={labelled ? 10 : 8} fontFamily="IBM Plex Mono, ui-monospace, monospace">{tick.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function gaugeTicks(marks: readonly { mm: number; selected?: boolean }[], maxMm: number): GaugeTick[] {
  if (maxMm <= 0) return [];
  return marks.map((mark) => ({ id: String(mark.mm), fraction: mark.mm / maxMm, label: String(mark.mm), selected: mark.selected }));
}
