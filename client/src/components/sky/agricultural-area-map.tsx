import { useEffect, useMemo, useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import type { AgriculturalMarket } from "../../../../shared/agricultural-markets";

type MapStatus = "researching_evidence" | "validated" | "DATA_UNAVAILABLE" | "map_unavailable";

interface AgriculturalAreaMapProps {
  market: AgriculturalMarket;
  status?: MapStatus;
  stationCoordinates?: { latitude: number; longitude: number };
  variant?: "compact" | "standard";
}

const STATUS_LABELS: Record<MapStatus, string> = {
  researching_evidence: "Researching evidence",
  validated: "NOAA station validated",
  DATA_UNAVAILABLE: "DATA_UNAVAILABLE",
  map_unavailable: "Map unavailable",
};

function bounded(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function openStreetMapUrls(market: AgriculturalMarket) {
  const latitudeSpan = 0.16;
  const longitudeSpan = 0.24;
  const south = bounded(market.latitude - latitudeSpan, -85, 85).toFixed(5);
  const north = bounded(market.latitude + latitudeSpan, -85, 85).toFixed(5);
  const west = bounded(market.longitude - longitudeSpan, -180, 180).toFixed(5);
  const east = bounded(market.longitude + longitudeSpan, -180, 180).toFixed(5);
  const latitude = market.latitude.toFixed(5);
  const longitude = market.longitude.toFixed(5);
  const bbox = encodeURIComponent(`${west},${south},${east},${north}`);

  return {
    embed: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`,
    larger: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=${market.mapZoom ?? 11}/${latitude}/${longitude}`,
  };
}

export function AgriculturalAreaMap({
  market,
  status = market.evidenceStatus,
  stationCoordinates,
  variant = "standard",
}: AgriculturalAreaMapProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const urls = useMemo(() => openStreetMapUrls(market), [market]);
  const preciseLocation = `${market.name}, ${market.administrativeArea}, ${market.country}`;
  const mapTitle = `${preciseLocation} reference location on OpenStreetMap`;
  const hasValidatedStation = status === "validated" && Boolean(stationCoordinates);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [market.slug]);

  return (
    <figure
      className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]"
      aria-labelledby={`map-caption-${market.slug}-${variant}`}
    >
      <div
        className={variant === "compact" ? "relative h-40 w-full bg-[var(--surface-1)]" : "relative h-56 w-full bg-[var(--surface-1)] sm:h-64"}
        aria-busy={!loaded && !failed}
      >
        {!loaded && !failed && (
          <div className="absolute inset-0 flex items-center justify-center px-5 text-center" role="status">
            <div>
              <MapPin className="mx-auto h-6 w-6 text-[var(--identity)]" aria-hidden="true" />
              <p className="mt-2 text-xs font-semibold text-[var(--foreground)]">Loading geographic context</p>
              <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">{preciseLocation}</p>
            </div>
          </div>
        )}

        {!failed && (
          <iframe
            key={market.slug}
            src={urls.embed}
            title={mapTitle}
            loading={variant === "compact" ? "lazy" : "eager"}
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full border-0 bg-transparent"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        )}

        {failed && (
          <div className="absolute inset-0 flex items-center justify-center px-5 text-center" role="status">
            <div>
              <MapPin className="mx-auto h-6 w-6 text-[var(--warning)]" aria-hidden="true" />
              <p className="mt-2 text-xs font-semibold text-[var(--foreground)]">Map unavailable</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted-foreground)]">{preciseLocation}<br />Reference coordinates: {market.latitude.toFixed(4)}, {market.longitude.toFixed(4)}</p>
            </div>
          </div>
        )}

        <span className="pointer-events-none absolute left-3 top-3 rounded-md border border-black/15 bg-white/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-800 shadow-sm">
          Reference location
        </span>
      </div>

      <figcaption id={`map-caption-${market.slug}-${variant}`} className="border-t border-[var(--border)] px-3 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <strong className="block text-xs text-[var(--foreground)]">{preciseLocation}</strong>
            <span className="mt-1 block text-[11px] text-[var(--muted-foreground)]">Catalog group: {market.region}</span>
          </div>
          <span className="shrink-0 rounded-full border border-[var(--border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-[var(--muted-foreground)]">
            {STATUS_LABELS[failed ? "map_unavailable" : status]}
          </span>
        </div>

        {variant === "standard" && (
          <div className="mt-3 grid gap-2 border-t border-[var(--border)] pt-3 text-[11px] leading-relaxed text-[var(--muted-foreground)] sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p>The marker identifies the index reference location, not an insured boundary.</p>
              <p className="mt-1">WeatherXM: context only—not used for settlement. NOAA is the sole settlement source.</p>
              {hasValidatedStation && <p className="mt-1 text-[var(--warning)]">A validated NOAA station exists; its coordinates are listed in the evidence record outside this map.</p>}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 sm:justify-end">
              <a href={urls.larger} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-[var(--identity)] underline underline-offset-4 hover:text-[var(--foreground)]">
                Open larger map <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-[var(--muted-foreground)] underline underline-offset-4 hover:text-[var(--foreground)]">
                © OpenStreetMap contributors
              </a>
            </div>
          </div>
        )}

        {variant === "compact" && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-2 text-[11px]">
            <span className="text-[var(--faint)]">Reference point only · no coverage boundary</span>
            <span className="flex flex-wrap items-center gap-x-4">
              <a href={urls.larger} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-[var(--identity)] underline underline-offset-4 hover:text-[var(--foreground)]">
                Larger map <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-[var(--muted-foreground)] underline underline-offset-4 hover:text-[var(--foreground)]">
                © OpenStreetMap contributors
              </a>
            </span>
          </div>
        )}
      </figcaption>
    </figure>
  );
}
