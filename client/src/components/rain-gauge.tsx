import { useId } from "react";

type GaugeTick = { id: string; fraction: number; label: string; selected?: boolean; labelled?: boolean };

/** Graduated cylinder. Empty tube is dry-fill. Water is glacier. The trigger line is slicker. Other ticks are --tick. */
export function RainGauge({ level, ticks, label, rising = true, labelled = false }: { level: number; ticks: GaugeTick[]; label?: string; rising?: boolean; labelled?: boolean }) {
  const clipId = useId().replace(/:/g, "");
  const fill = Math.min(1, Math.max(0, level));
  const waterHeight = 128 * fill;
  const waterY = 148 - waterHeight;
  const width = labelled ? 132 : 72;
  const visible = ticks.filter((tick, index) => {
    if (tick.labelled === false || !tick.label) return true;
    const y = 148 - 128 * Math.min(1, Math.max(0, tick.fraction));
    return !ticks.some((other, otherIndex) => {
      if (otherIndex >= index || other.labelled === false || !other.label) return false;
      const otherY = 148 - 128 * Math.min(1, Math.max(0, other.fraction));
      return Math.abs(otherY - y) < 14 && (other.selected || !tick.selected);
    });
  });
  return (
    <svg className={labelled ? "rain-gauge rain-gauge--ladder" : "rain-gauge"} viewBox={`0 0 ${width} 168`} role="img" aria-label={label ?? "Rain gauge"} data-rising={rising ? "true" : "false"}>
      <rect x="16" y="8" width="32" height="144" rx="16" fill="var(--dry-fill)" stroke="var(--tick)" strokeWidth="1.5" />
      <clipPath id={clipId}>
        <rect x="20" y="16" width="24" height="132" rx="12" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <rect className="rain-gauge__water" x="20" y={waterY} width="24" height={waterHeight} fill="var(--glacier)" />
      </g>
      {visible.map((tick) => {
        const y = 148 - 128 * Math.min(1, Math.max(0, tick.fraction));
        const showLabel = tick.labelled !== false && Boolean(tick.label);
        const x2 = tick.selected ? 68 : showLabel ? 60 : 56;
        return (
          <g key={tick.id} className={tick.selected ? "rain-gauge__trigger" : undefined}>
            <line x1="48" x2={x2} y1={y} y2={y} stroke={tick.selected ? "var(--slicker)" : "var(--tick)"} strokeWidth={tick.selected ? 2 : 1.5} />
            {showLabel ? <text x={labelled ? 72 : 62} y={y + 3} fill={tick.selected ? "var(--slicker)" : "var(--fg-3)"} fontSize={labelled ? 11 : 9} fontFamily="IBM Plex Mono, ui-monospace, monospace">{tick.label}</text> : null}
          </g>
        );
      })}
    </svg>
  );
}

export function gaugeTicks(marks: readonly { mm: number; selected?: boolean; labelled?: boolean }[], maxMm: number): GaugeTick[] {
  if (maxMm <= 0) return [];
  return marks.map((mark) => ({
    id: String(mark.mm),
    fraction: mark.mm / maxMm,
    label: mark.labelled === false ? "" : String(mark.mm),
    selected: mark.selected,
    labelled: mark.labelled !== false,
  }));
}
