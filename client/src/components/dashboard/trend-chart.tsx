import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";

const PERIODS = [
  { label: "4W", weeks: 4 },
  { label: "8W", weeks: 8 },
  { label: "12W", weeks: 12 },
] as const;

export function TrendChart({ history, normalMm, strikeMm, side }: { history: Array<{ week: string; mm: number | null }>; normalMm: number; strikeMm: number | null; side: "call" | "put" | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["weeks"]>(12);

  const data = useMemo(() => history.slice(-period).filter((w): w is { week: string; mm: number } => w.mm !== null), [history, period]);
  const isEmpty = data.length === 0;

  const summary = useMemo(() => {
    if (!data.length) return null;
    const latest = data[data.length - 1];
    const values = data.map((d) => d.mm);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const maxWeek = data.reduce((a, b) => (b.mm > a.mm ? b : a), data[0]);
    const vsNormal = normalMm > 0 ? Math.round((avg / normalMm) * 100) : null;
    return { latest, avg, maxWeek, vsNormal };
  }, [data, normalMm]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = container.offsetWidth || 600;
    const height = 280;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const labels = history.slice(-period).map((w) => w.week.slice(5));
    if (isEmpty) return;

    const padding = { top: 24, right: 16, bottom: 28, left: 44 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const max = Math.max(normalMm, strikeMm ?? 0, ...data.map((d) => d.mm), 1) * 1.15;
    const min = 0;
    const step = Math.max(1, data.length - 1);

    const x = (i: number) => padding.left + (i / step) * chartW;
    const y = (v: number) => padding.top + (1 - (v - min) / (max - min)) * chartH;

    ctx.strokeStyle = "rgba(148,163,184,0.08)";
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    for (let i = 0; i <= 4; i++) {
      const gy = padding.top + (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, gy);
      ctx.lineTo(padding.left + chartW, gy);
      ctx.stroke();
      ctx.fillStyle = "#64748B";
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${Math.round((max / 4) * (4 - i))}`, padding.left - 8, gy + 3);
    }

    if (normalMm > 0) {
      const ny = y(normalMm);
      ctx.strokeStyle = "#38BDF8";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding.left, ny);
      ctx.lineTo(padding.left + chartW, ny);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#38BDF8";
      ctx.font = "10px Inter";
      ctx.textAlign = "left";
      ctx.fillText(`normal ${normalMm}mm`, padding.left + 8, ny - 6);
    }

    if (strikeMm !== null) {
      const sy = y(strikeMm);
      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding.left, sy);
      ctx.lineTo(padding.left + chartW, sy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#F59E0B";
      ctx.font = "10px Inter";
      ctx.textAlign = "left";
      ctx.fillText(`${side === "call" ? "strike ≥" : "strike ≤"} ${strikeMm}mm`, padding.left + 8, sy + 14);
    }

    const lineColor = "#38BDF8";
    ctx.beginPath();
    ctx.moveTo(x(0), y(data[0].mm));
    data.forEach((d, i) => ctx.lineTo(x(i), y(d.mm)));
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "rgba(56,189,248,0.1)";
    ctx.beginPath();
    ctx.moveTo(x(0), y(0));
    data.forEach((d, i) => ctx.lineTo(x(i), y(d.mm)));
    ctx.lineTo(x(data.length - 1), y(0));
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = lineColor;
    data.forEach((d, i) => {
      ctx.beginPath();
      ctx.arc(x(i), y(d.mm), 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#64748B";
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    const labelEvery = Math.ceil(labels.length / 6);
    labels.forEach((label, i) => {
      if (i % labelEvery !== 0 && i !== labels.length - 1) return;
      ctx.fillText(label, x(i), height - 8);
    });
  }, [history, normalMm, strikeMm, side, period, isEmpty]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 sky-eyebrow">
          <BarChart3 className="h-3.5 w-3.5 text-[var(--identity)]" />
          Weekly rainfall trend · settled weeks
        </div>
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.weeks}
              aria-pressed={period === p.weeks}
              onClick={() => setPeriod(p.weeks)}
              className={cn(
                "sky-mono flex min-h-10 items-center rounded-md border px-3 text-xs font-medium transition-colors",
                period === p.weeks ? "border-[var(--identity)] bg-[var(--identity-dim)] text-[var(--identity)]" : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--identity)]/50",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={containerRef} className="relative w-full overflow-hidden">
        <canvas ref={canvasRef} className="block" aria-hidden />
        {isEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <CloudOff className="h-5 w-5 text-[var(--faint)]" />
            <p className="max-w-xs text-sm leading-relaxed text-[var(--muted-foreground)]">
              Live observations pending — settled weeks appear here once NOAA history lands for this index.
            </p>
          </div>
        )}
      </div>
      {summary && (
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Chart summary">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)]/60 px-3 py-2">
            <dt className="sky-eyebrow">Latest week</dt>
            <dd className="sky-mono mt-0.5 text-sm font-medium">{summary.latest.mm} mm <span className="text-[10px] text-[var(--faint)]">{summary.latest.week.slice(5)}</span></dd>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)]/60 px-3 py-2">
            <dt className="sky-eyebrow">Avg · {PERIODS.find((p) => p.weeks === period)?.label}</dt>
            <dd className="sky-mono mt-0.5 text-sm font-medium">{summary.avg.toFixed(1)} mm</dd>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)]/60 px-3 py-2">
            <dt className="sky-eyebrow">Wettest week</dt>
            <dd className="sky-mono mt-0.5 text-sm font-medium">{summary.maxWeek.mm} mm <span className="text-[10px] text-[var(--faint)]">{summary.maxWeek.week.slice(5)}</span></dd>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)]/60 px-3 py-2">
            <dt className="sky-eyebrow">Avg vs normal</dt>
            <dd className={cn("sky-mono mt-0.5 text-sm font-medium", summary.vsNormal !== null && summary.vsNormal < 80 && "text-[var(--warning)]")}>
              {summary.vsNormal !== null ? `${summary.vsNormal}%` : "—"}
            </dd>
          </div>
        </dl>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[10px] text-[var(--faint)]">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-[var(--identity)]" /> weekly total</span>
        <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t border-dashed border-[var(--identity)]" /> normal</span>
        {strikeMm !== null && (
          <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t border-dashed border-[var(--warning)]" /> strike</span>
        )}
      </div>
    </div>
  );
}