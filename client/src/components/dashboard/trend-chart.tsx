import { useEffect, useRef, useState } from "react";
import { BarChart3 } from "lucide-react";
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

    const data = history.slice(-period).filter((w): w is { week: string; mm: number } => w.mm !== null);
    const labels = history.slice(-period).map((w) => w.week.slice(5));
    if (!data.length) {
      ctx.fillStyle = "#64748B";
      ctx.font = "12px Inter";
      ctx.textAlign = "center";
      ctx.fillText("Live observations pending — NOAA history unavailable", width / 2, height / 2);
      return;
    }

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
      ctx.strokeStyle = side === "call" ? "#22C55E" : "#F59E0B";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding.left, sy);
      ctx.lineTo(padding.left + chartW, sy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = side === "call" ? "#22C55E" : "#F59E0B";
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
  }, [history, normalMm, strikeMm, side, period]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sky-eyebrow">
          <BarChart3 className="h-3.5 w-3.5 text-[var(--identity)]" />
          Weekly rainfall trend · settled weeks
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.weeks}
              onClick={() => setPeriod(p.weeks)}
              className={cn(
                "sky-mono rounded-md border px-2.5 py-1 text-[10px] font-medium transition-colors",
                period === p.weeks ? "border-[var(--identity)] bg-[var(--identity-dim)] text-[var(--identity)]" : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--identity)]/50",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={containerRef} className="w-full overflow-hidden">
        <canvas ref={canvasRef} className="block" />
      </div>
      <div className="mt-3 flex items-center gap-5 text-[10px] text-[var(--faint)]">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-[var(--identity)]" /> weekly total</span>
        <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t border-dashed border-[var(--identity)]" /> normal</span>
        {strikeMm !== null && (
          <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t border-dashed" style={{ borderColor: side === "call" ? "#22C55E" : "#F59E0B" }} /> strike</span>
        )}
      </div>
    </div>
  );
}