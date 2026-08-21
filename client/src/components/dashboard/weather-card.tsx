import { MapPin } from "lucide-react";
import type { CityIndexState } from "@/lib/types";
import { mm } from "@/lib/api";
import { Card, CoverageBadge, Pill, SourceBadge } from "@/components/sky";
import { cn } from "@/lib/utils";

export function OddsGauge({ anchorMm, strikeMm, normalMm, probBps }: { anchorMm: number | null; strikeMm: number | null; normalMm: number; probBps: number | null }) {
  const scale = Math.max(normalMm * 1.6, strikeMm ?? 0, anchorMm ?? 0, 1);
  const pos = (v: number) => `${Math.max(4, Math.min(96, (v / scale) * 100))}%`;
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-24 w-2.5 shrink-0 rounded-full bg-[var(--surface-2)]">
        {strikeMm !== null && (
          <span className="absolute left-1/2 h-px w-6 -translate-x-1/2 bg-[var(--success)]" style={{ bottom: pos(strikeMm) }} />
        )}
        <span className="absolute left-1/2 h-px w-6 -translate-x-1/2 border-t border-dashed border-[var(--identity)]" style={{ bottom: pos(normalMm) }} />
        {anchorMm !== null && (
          <span className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-[var(--background)] bg-[var(--warning)]" style={{ bottom: pos(anchorMm) }} />
        )}
      </div>
      <div>
        <div className="sky-mono text-5xl font-semibold leading-none tracking-tight text-[var(--identity)]">
          {anchorMm !== null ? `${anchorMm.toLocaleString("en-US", { maximumFractionDigits: 1 })}` : "—"}
          <span className="text-lg text-[var(--muted-foreground)]"> mm</span>
        </div>
        <div className="mt-2 flex items-center gap-2 sky-eyebrow">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[var(--warning)]" /> live total</span>
          <span className="flex items-center gap-1"><span className="h-px w-3 border-t border-dashed border-[var(--identity)]" /> normal</span>
          {strikeMm !== null && <span className="flex items-center gap-1"><span className="h-px w-3 bg-[var(--success)]" /> strike</span>}
        </div>
      </div>
      <div className="ml-auto text-right">
        <div className="sky-eyebrow">model Δ</div>
        <div className="sky-mono text-2xl font-semibold text-[var(--foreground)]">{probBps !== null ? `${(probBps / 100).toFixed(1)}%` : "—"}</div>
      </div>
    </div>
  );
}

export function WeatherCard({ city, probBps, strikeMm }: { city: CityIndexState; probBps: number | null; strikeMm: number | null }) {
  const pace = city.cumulativeMm !== null && city.currentWindow.progressPct > 0 ? city.cumulativeMm / Math.max((city.windowNormalMm * city.currentWindow.progressPct) / 100, 0.01) : null;
  const paceLabel = pace === null ? null : pace >= 1.25 ? "WET PACE" : pace <= 0.6 ? "DRY PACE" : "ON PACE";
  return (
    <div className="sky-hero-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="sky-display text-xl font-bold tracking-tight">{city.name}</h2>
            <CoverageBadge tier={city.coverageTier} />
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
            <MapPin className="h-3 w-3" /> {city.country} · {city.stationName}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <SourceBadge source={city.probabilitySource} />
          {pace !== null && paceLabel && <Pill tone={pace >= 1.25 ? "amber" : pace <= 0.6 ? "cyan" : "slate"}>{paceLabel}</Pill>}
        </div>
      </div>

      <div className="mt-5">
        <OddsGauge anchorMm={city.cumulativeMm} strikeMm={strikeMm} normalMm={city.windowNormalMm} probBps={probBps} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)]/60 px-3 py-2">
          <div className="sky-eyebrow">Window</div>
          <div className="sky-mono mt-0.5 font-medium">{city.currentWindow.start.slice(5)} → {city.currentWindow.end.slice(5)}</div>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)]/60 px-3 py-2">
          <div className="sky-eyebrow">Elapsed</div>
          <div className="sky-mono mt-0.5 font-medium">{city.currentWindow.progressPct}%</div>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)]/60 px-3 py-2">
          <div className="sky-eyebrow">Normal</div>
          <div className="sky-mono mt-0.5 font-medium">{mm(city.windowNormalMm)}</div>
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className="h-full rounded-full bg-gradient-to-r from-[var(--identity-deep)] to-[var(--identity)] transition-all" style={{ width: `${city.currentWindow.progressPct}%` }} />
      </div>
    </div>
  );
}

export function MarketStatusCard({ city, chain }: { city: CityIndexState; chain: { probabilitySource: string; strikes: number[] } | undefined }) {
  const openCells = chain ? chain.strikes.length : 0;
  const cells: Array<[string, string, string?]> = [
    ["Index", city.metric.replaceAll("_", " ")],
    ["Strikes", String(openCells)],
    ["Model", chain?.probabilitySource === "noaa-10yr" ? "NOAA 10yr" : "climatology"],
    ["Settlement", "NOAA + WXM"],
    ["Observed", city.cumulativeMm !== null ? mm(city.cumulativeMm) : "pending", city.cumulativeMm !== null ? "text-[var(--success)]" : "text-[var(--faint)]"],
  ];
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="sky-eyebrow">Market status</div>
        <span className="sky-live-dot" />
      </div>
      <dl className="mt-3 divide-y divide-[var(--border)] text-xs">
        {cells.map(([k, v, cls]) => (
          <div key={k} className="flex items-center justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
            <dt className="text-[var(--muted-foreground)]">{k}</dt>
            <dd className={cn("sky-mono font-medium", cls)}>{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}