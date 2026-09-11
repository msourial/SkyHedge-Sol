import type { AgriculturalMarket } from "../../../../shared/agricultural-markets";

type MapStatus = "researching_evidence" | "validated" | "DATA_UNAVAILABLE" | "map_unavailable";

interface AgriculturalAreaMapProps {
  market: AgriculturalMarket;
  status?: MapStatus;
  stationCoordinates?: { latitude: number; longitude: number };
}

function project(latitude: number, longitude: number): { x: number; y: number } {
  return { x: 8 + ((longitude + 180) / 360) * 84, y: 12 + ((90 - latitude) / 180) * 76 };
}

export function AgriculturalAreaMap({ market, status = market.evidenceStatus, stationCoordinates }: AgriculturalAreaMapProps) {
  const area = project(market.latitude, market.longitude);
  const station = stationCoordinates ? project(stationCoordinates.latitude, stationCoordinates.longitude) : null;
  const statusLabel = status === "validated" ? "NOAA station validated" : status === "DATA_UNAVAILABLE" ? "DATA_UNAVAILABLE" : status === "map_unavailable" ? "Map unavailable" : "Researching evidence";
  return (
    <figure className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]" aria-labelledby={`map-title-${market.slug}`}>
      <div className="relative aspect-[2/1] min-h-40 w-full">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" role="img" aria-labelledby={`map-title-${market.slug}`}>
          <title id={`map-title-${market.slug}`}>{market.name} reference area map</title>
          <rect width="100" height="100" fill="currentColor" className="text-[var(--surface-2)]" />
          <path d="M2 28C16 17 26 25 38 18S61 12 72 20s18 4 26 10M4 57c14-8 21 3 34-3s22-9 33-2 20 0 27-5M10 82c11-6 22 1 32-4s23-4 34 2 16 1 23-3" fill="none" stroke="currentColor" strokeWidth=".35" className="text-[var(--border)]" aria-hidden="true" />
          <path d="M25 7v86M50 7v86M75 7v86M5 33h90M5 66h90" fill="none" stroke="currentColor" strokeWidth=".2" strokeDasharray="1 2" className="text-[var(--faint)]" aria-hidden="true" />
          {station && <line x1={area.x} y1={area.y} x2={station.x} y2={station.y} stroke="currentColor" strokeWidth=".6" strokeDasharray="1.5 1.5" className="text-[var(--warning)]" aria-hidden="true" />}
          <circle cx={area.x} cy={area.y} r="3.3" fill="currentColor" className="text-[var(--identity)]" />
          <circle cx={area.x} cy={area.y} r="5.5" fill="none" stroke="currentColor" strokeWidth=".45" className="text-[var(--identity)]" />
          {station && <circle cx={station.x} cy={station.y} r="2.1" fill="currentColor" className="text-[var(--warning)]" />}
        </svg>
        <div className="absolute left-3 top-3 rounded-md border border-[var(--border)] bg-[var(--surface-1)]/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--faint)]">Reference area</div>
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 text-[10px] text-[var(--muted-foreground)]">
          <span className="inline-flex items-center gap-1 rounded bg-[var(--surface-1)]/90 px-2 py-1"><i className="h-2 w-2 rounded-full bg-[var(--identity)]" aria-hidden="true" /> Index area</span>
          {station && <span className="inline-flex items-center gap-1 rounded bg-[var(--surface-1)]/90 px-2 py-1"><i className="h-2 w-2 rounded-full bg-[var(--warning)]" aria-hidden="true" /> NOAA station</span>}
        </div>
      </div>
      <figcaption className="flex flex-wrap items-start justify-between gap-3 border-t border-[var(--border)] px-3 py-2.5 text-xs">
        <span id={`map-title-${market.slug}`} className="min-w-0"><strong className="block text-[var(--foreground)]">{market.name}</strong><span className="text-[var(--muted-foreground)]">{market.administrativeArea}, {market.country}</span></span>
        <span className="shrink-0 rounded-full border border-[var(--border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--muted-foreground)]">{statusLabel}</span>
      </figcaption>
      <p className="px-3 pb-3 text-[11px] leading-relaxed text-[var(--faint)]">Coordinates identify the index reference area, not an insured boundary. WeatherXM context is not used for settlement.</p>
    </figure>
  );
}
