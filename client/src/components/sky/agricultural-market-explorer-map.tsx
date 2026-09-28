import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { AlertTriangle, LoaderCircle, MapPin, RefreshCw } from "lucide-react";
import type { AgriculturalMarket } from "../../../../shared/agricultural-markets";
import { agriculturalMarketLocation } from "../../../../shared/agricultural-markets";

import "maplibre-gl/dist/maplibre-gl.css";

type MapPhase = "idle" | "loading" | "slow" | "ready" | "unavailable";
type MarketEvidenceStatus = AgriculturalMarket["evidenceStatus"] | "DATA_UNAVAILABLE";

interface AgriculturalMarketExplorerMapProps {
  markets: readonly AgriculturalMarket[];
  selectedSlug: string;
  getEvidenceStatus?: (market: AgriculturalMarket) => MarketEvidenceStatus;
  onSelect: (slug: AgriculturalMarket["slug"]) => void;
}

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY?.trim() ?? "";
const MAP_STYLE_URL = `https://api.maptiler.com/maps/dataviz-v4-dark/style.json?key=${encodeURIComponent(MAPTILER_KEY)}`;

function validCoordinates(market: AgriculturalMarket) {
  return Number.isFinite(market.latitude) && Number.isFinite(market.longitude)
    && Math.abs(market.latitude) <= 85 && Math.abs(market.longitude) <= 180;
}

function defaultEvidenceStatus(market: AgriculturalMarket): MarketEvidenceStatus {
  return market.evidenceStatus;
}

export function AgriculturalMarketExplorerMap({ markets, selectedSlug, getEvidenceStatus = defaultEvidenceStatus, onSelect }: AgriculturalMarketExplorerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  const [nearViewport, setNearViewport] = useState(false);
  const [phase, setPhase] = useState<MapPhase>("idle");
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const configured = Boolean(MAPTILER_KEY);
  const mappableMarkets = useMemo(() => markets.filter(validCoordinates), [markets]);

  onSelectRef.current = onSelect;

  useEffect(() => {
    const element = containerRef.current;
    if (!element || nearViewport || !configured) return;
    if (!("IntersectionObserver" in window)) {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: "300px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [configured, nearViewport]);

  useEffect(() => {
    if (!configured) {
      setPhase("unavailable");
      return;
    }
    if (!nearViewport) { setPhase("idle"); return; }
    if (!containerRef.current) { setPhase("unavailable"); return; }

    let cancelled = false;
    let errorCount = 0;
    setLoaded(false);
    setPhase("loading");
    const slowTimer = window.setTimeout(() => setPhase((current) => current === "loading" ? "slow" : current), 6_000);
    const unavailableTimer = window.setTimeout(() => setPhase((current) => current === "ready" ? current : "unavailable"), 15_000);

    void import("maplibre-gl").then((maplibre) => {
      if (cancelled || !containerRef.current) return;
      maplibreRef.current = maplibre;
      const map = new maplibre.Map({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center: [-20, 4],
        zoom: 1,
        minZoom: 1,
        maxZoom: 11,
        attributionControl: { compact: true },
        cooperativeGestures: true,
        fadeDuration: 0,
      });
      mapRef.current = map;
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      map.once("load", () => {
        if (cancelled) return;
        setLoaded(true);
        setPhase(errorCount >= 3 ? "unavailable" : "ready");
      });
      map.on("error", () => {
        if (cancelled) return;
        errorCount += 1;
        if (errorCount >= 3) setPhase("unavailable");
      });
    }).catch(() => {
      if (!cancelled) setPhase("unavailable");
    });

    return () => {
      cancelled = true;
      window.clearTimeout(slowTimer);
      window.clearTimeout(unavailableTimer);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
    };
  }, [attempt, configured, nearViewport]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!loaded || !map || !maplibre) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    if (!mappableMarkets.length) return;
    const bounds = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
    const newMarkers: Marker[] = [];

    for (const market of mappableMarkets) {
      const status = getEvidenceStatus(market);
      const markerButton = document.createElement("button");
      markerButton.type = "button";
      markerButton.className = "sky-index-marker";
      markerButton.dataset.selected = String(market.slug === selectedSlug);
      markerButton.dataset.evidenceStatus = status.toLowerCase().replaceAll("_", "-");
      markerButton.dataset.latitude = String(market.latitude);
      markerButton.dataset.longitude = String(market.longitude);
      markerButton.setAttribute("aria-pressed", String(market.slug === selectedSlug));
      markerButton.setAttribute("aria-label", `${agriculturalMarketLocation(market)}. Index reference location. Evidence: ${status === "validated" ? "NOAA station validated" : status === "DATA_UNAVAILABLE" ? "Data unavailable" : "Researching evidence"}. Select to view protection details.`);
      markerButton.title = `${agriculturalMarketLocation(market)} · Index reference point`;
      markerButton.addEventListener("click", () => onSelectRef.current(market.slug));
      const marker = new maplibre.Marker({ element: markerButton, anchor: "center" })
        .setLngLat([market.longitude, market.latitude])
        .addTo(map);
      newMarkers.push(marker);
      bounds.west = Math.min(bounds.west, market.longitude);
      bounds.south = Math.min(bounds.south, market.latitude);
      bounds.east = Math.max(bounds.east, market.longitude);
      bounds.north = Math.max(bounds.north, market.latitude);
    }
    markersRef.current = newMarkers;

    const padding = window.innerWidth < 768 ? 44 : 72;
    const maxZoom = mappableMarkets.length === 1 ? 5 : mappableMarkets.length < 6 ? 4.2 : 2.5;
    map.fitBounds([[bounds.west, bounds.south], [bounds.east, bounds.north]] as [[number, number], [number, number]], { padding, maxZoom, duration: 500 });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [getEvidenceStatus, loaded, markets, mappableMarkets, selectedSlug]);

  const retry = useCallback(() => {
    setPhase("loading");
    setAttempt((current) => current + 1);
  }, []);
  const fallback = !configured || phase === "unavailable";

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-700 bg-[#111c2b] shadow-xl" aria-label="Agricultural index map">
      <div className="relative h-[min(70vh,48rem)] min-h-[25rem] w-full bg-[#101a28] sm:min-h-[32rem]" data-testid="market-explorer-map" data-map-state={configured ? phase : "unconfigured"}>
        {configured && <div ref={containerRef} className="sky-maplibre-map absolute inset-0" aria-label="Interactive map of catalog index reference locations" />}
        {!configured && (
          <div className="absolute inset-0 flex items-center justify-center px-6 py-10 text-center">
            <div className="max-w-lg">
              <MapPin className="mx-auto h-8 w-8 text-cyan-300" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-semibold text-slate-100">Map provider not configured</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">Add a domain-restricted MapTiler key to display the interactive map. The index locations and evidence states remain available in the list.</p>
            </div>
          </div>
        )}
        {configured && !fallback && phase !== "ready" && (
          <div className={`absolute inset-x-4 z-[2] mx-auto max-w-lg rounded-xl border border-slate-600 bg-slate-950/90 p-4 text-center text-slate-100 shadow-lg ${phase === "slow" ? "bottom-4" : "top-1/2 -translate-y-1/2"}`} role="status" aria-live="polite">
            {phase === "idle" || phase === "loading" ? <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-cyan-300" aria-hidden="true" /> : <AlertTriangle className="mx-auto h-6 w-6 text-amber-300" aria-hidden="true" />}
            <p className="mt-2 text-sm font-semibold">{phase === "slow" ? "Map is taking longer than expected" : "Loading index reference locations"}</p>
            {phase === "slow" && <button type="button" onClick={retry} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-500 px-4 text-sm hover:border-cyan-300"><RefreshCw className="h-4 w-4" aria-hidden="true" />Retry map</button>}
          </div>
        )}
        {configured && fallback && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#101a28] px-6 py-10 text-center" role="alert">
            <div className="max-w-lg">
              <AlertTriangle className="mx-auto h-7 w-7 text-amber-300" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-semibold text-slate-100">Map unavailable</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">Map tiles could not be loaded. The catalog list below still shows exact reference locations and evidence status; it does not indicate station coverage.</p>
              <button type="button" onClick={retry} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-500 px-4 text-sm text-slate-100 hover:border-cyan-300"><RefreshCw className="h-4 w-4" aria-hidden="true" />Retry map</button>
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-3 left-3 z-[1] rounded-lg border border-slate-600/70 bg-slate-950/85 px-3 py-2 text-xs text-slate-100 shadow-lg">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.85)]" aria-hidden="true" />
          <span className="ml-2">Index reference locations only</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-700 bg-[#172334] px-4 py-3 text-xs text-slate-300">
        <span>Each marker identifies a reference point, not an insured boundary or weather station.</span>
        <span>NOAA is the sole settlement source.</span>
      </div>
    </section>
  );
}
