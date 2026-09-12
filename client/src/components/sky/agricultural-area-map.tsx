import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, MapPin, RefreshCw } from "lucide-react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";
import type { AgriculturalMarket } from "../../../../shared/agricultural-markets";
import { agriculturalMarketLocation } from "../../../../shared/agricultural-markets";

type MapStatus = "researching_evidence" | "validated" | "DATA_UNAVAILABLE" | "map_unavailable";
type MapLoadPhase = "idle" | "loading" | "slow" | "ready" | "unavailable";

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

function openStreetMapUrl(market: AgriculturalMarket): string {
  const latitude = market.latitude.toFixed(5);
  const longitude = market.longitude.toFixed(5);
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=${market.mapZoom ?? 11}/${latitude}/${longitude}`;
}

function MapSizeController({ marketSlug }: { marketSlug: string }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize(false);
    const frame = window.requestAnimationFrame(() => map.invalidateSize(false));
    return () => window.cancelAnimationFrame(frame);
  }, [map, marketSlug]);

  return null;
}

export function AgriculturalAreaMap({
  market,
  status = market.evidenceStatus,
  stationCoordinates,
  variant = "standard",
}: AgriculturalAreaMapProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const tileErrors = useRef(0);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<MapLoadPhase>("idle");
  const location = agriculturalMarketLocation(market);
  const largerMapUrl = openStreetMapUrl(market);
  const coordinatesValid = Number.isFinite(market.latitude) && Number.isFinite(market.longitude) && Math.abs(market.latitude) <= 85 && Math.abs(market.longitude) <= 180;
  const stationValidated = status === "validated" && Boolean(stationCoordinates);

  useEffect(() => {
    const node = shellRef.current;
    if (!node || shouldLoad) return;
    if (!("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setShouldLoad(true);
        observer.disconnect();
      }
    }, { rootMargin: "240px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldLoad]);

  useEffect(() => {
    tileErrors.current = 0;
    if (!coordinatesValid) {
      setPhase("unavailable");
      return;
    }
    if (!shouldLoad) {
      setPhase("idle");
      return;
    }
    setPhase("loading");
    const slowTimer = window.setTimeout(() => {
      setPhase((current) => current === "loading" ? "slow" : current);
    }, 6_000);
    const unavailableTimer = window.setTimeout(() => {
      setPhase((current) => current === "ready" ? current : "unavailable");
    }, 15_000);
    return () => {
      window.clearTimeout(slowTimer);
      window.clearTimeout(unavailableTimer);
    };
  }, [attempt, coordinatesValid, market.slug, shouldLoad]);

  const handleLayerLoad = useCallback(() => {
    if (tileErrors.current === 0) setPhase("ready");
    else if (tileErrors.current >= 3) setPhase("unavailable");
  }, []);
  const handleTileError = useCallback(() => {
    tileErrors.current += 1;
    if (tileErrors.current >= 3) setPhase((current) => current === "ready" ? current : "unavailable");
  }, []);
  const retry = () => {
    tileErrors.current = 0;
    setShouldLoad(true);
    setPhase("loading");
    setAttempt((current) => current + 1);
  };

  const mapUnavailable = phase === "unavailable";
  const statusLabel = STATUS_LABELS[mapUnavailable ? "map_unavailable" : status];

  return (
    <figure
      className="isolate overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]"
      aria-labelledby={`map-caption-${market.slug}-${variant}`}
      data-map-state={phase}
      data-testid={`area-map-${market.slug}`}
    >
      <div
        ref={shellRef}
        className={variant === "compact" ? "relative h-40 w-full bg-[var(--surface-1)]" : "relative h-56 w-full bg-[var(--surface-1)] sm:h-64"}
        aria-label={`${location} reference location map`}
        aria-busy={phase === "idle" || phase === "loading" || phase === "slow"}
      >
        {shouldLoad && !mapUnavailable && coordinatesValid && (
          <MapContainer
            key={`${market.slug}-${attempt}`}
            center={[market.latitude, market.longitude]}
            zoom={market.mapZoom ?? 11}
            zoomControl={false}
            scrollWheelZoom={false}
            className="sky-leaflet-map h-full w-full"
          >
            <MapSizeController marketSlug={market.slug} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
              url={`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png?market=${market.slug}&attempt=${attempt}`}
              eventHandlers={{ load: handleLayerLoad, tileerror: handleTileError }}
            />
            <ZoomControl position="topright" />
            <CircleMarker center={[market.latitude, market.longitude]} radius={8} pathOptions={{ color: "#041012", fillColor: "#2de2e6", fillOpacity: 1, weight: 3 }}>
              <Tooltip direction="top">{location}</Tooltip>
            </CircleMarker>
            {stationValidated && stationCoordinates && (
              <CircleMarker center={[stationCoordinates.latitude, stationCoordinates.longitude]} radius={6} pathOptions={{ color: "#041012", fillColor: "#ffcc4d", fillOpacity: 1, weight: 2 }}>
                <Tooltip direction="top">Validated NOAA settlement station</Tooltip>
              </CircleMarker>
            )}
          </MapContainer>
        )}

        {(phase === "idle" || phase === "loading") && (
          <div className="pointer-events-none absolute inset-0 z-[800] flex items-center justify-center bg-[var(--surface-1)]/90 px-5 text-center" role="status">
            <div>
              <MapPin className="mx-auto h-6 w-6 text-[var(--identity)]" aria-hidden="true" />
              <p className="mt-2 text-xs font-semibold text-[var(--foreground)]">Loading geographic context</p>
              <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">{location}</p>
            </div>
          </div>
        )}

        {phase === "slow" && (
          <div className="absolute inset-x-3 bottom-3 z-[800] rounded-lg border border-[var(--warning)]/50 bg-[var(--surface-1)]/95 p-3 shadow-xl" role="status">
            <p className="text-xs font-semibold text-[var(--foreground)]">Map is taking longer than expected.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={retry} className="sky-btn-ghost inline-flex min-h-11 items-center gap-2 px-3 py-2 text-xs"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />Retry</button>
              <a href={largerMapUrl} target="_blank" rel="noreferrer" className="sky-btn-ghost inline-flex min-h-11 items-center gap-2 px-3 py-2 text-xs">Open larger map <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
            </div>
          </div>
        )}

        {mapUnavailable && (
          <div className="absolute inset-0 z-[800] flex items-center justify-center bg-[var(--surface-1)] px-5 text-center" role="alert">
            <div>
              <MapPin className="mx-auto h-6 w-6 text-[var(--warning)]" aria-hidden="true" />
              <p className="mt-2 text-xs font-semibold text-[var(--foreground)]">Map unavailable</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted-foreground)]">{location}<br />Reference coordinates: {market.latitude.toFixed(4)}, {market.longitude.toFixed(4)}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={retry} className="sky-btn-ghost inline-flex min-h-11 items-center gap-2 px-3 py-2 text-xs"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />Retry</button>
                <a href={largerMapUrl} target="_blank" rel="noreferrer" className="sky-btn-ghost inline-flex min-h-11 items-center gap-2 px-3 py-2 text-xs">Open larger map <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
              </div>
            </div>
          </div>
        )}

        <span className="pointer-events-none absolute left-3 top-3 z-[700] rounded-md border border-black/15 bg-white/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-800 shadow-sm">Reference location</span>
      </div>

      <figcaption id={`map-caption-${market.slug}-${variant}`} className="border-t border-[var(--border)] px-3 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <strong className="block text-xs text-[var(--foreground)]">{location}</strong>
            <span className="mt-1 block text-[11px] text-[var(--muted-foreground)]">Catalog group: {market.region}</span>
          </div>
          <span className="shrink-0 rounded-full border border-[var(--border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-[var(--muted-foreground)]">{statusLabel}</span>
        </div>

        {variant === "standard" ? (
          <div className="mt-3 grid gap-2 border-t border-[var(--border)] pt-3 text-[11px] leading-relaxed text-[var(--muted-foreground)] sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p>The marker identifies the index reference location, not an insured boundary.</p>
              <p className="mt-1">WeatherXM: context only—not used for settlement. NOAA is the sole settlement source.</p>
            </div>
            <a href={largerMapUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-[var(--identity)] underline underline-offset-4 hover:text-[var(--foreground)]">Open larger map <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-2 text-[11px]">
            <span className="text-[var(--faint)]">Reference point only · no coverage boundary</span>
            <a href={largerMapUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-[var(--identity)] underline underline-offset-4 hover:text-[var(--foreground)]">Larger map <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
          </div>
        )}
      </figcaption>
    </figure>
  );
}
