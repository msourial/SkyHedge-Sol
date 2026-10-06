import type { AgriculturalMarket } from "./api";

export type ReferencePoint = {
  slug: string;
  location: string;
  latitude: number;
  longitude: number;
  zoom: number;
};

const pilotLocations: Record<string, string> = {
  "des-moines": "Des Moines, Iowa, United States",
  saskatoon: "Saskatoon, Saskatchewan, Canada",
  toronto: "Toronto, Ontario, Canada",
};

export function referenceLocationFor(slug: string | null, market: AgriculturalMarket | undefined): string | null {
  if (!slug) return null;
  return market ? `${market.locality}, ${market.administrativeArea}, ${market.country}` : pilotLocations[slug] ?? null;
}

export function referenceEvidenceLabel(hazard: "rainfall" | "wind-gust" | "snowfall" | null, rainfallValidated: boolean): string {
  if (hazard === "rainfall") return rainfallValidated ? "NOAA rainfall station package validated" : "Researching NOAA rainfall evidence";
  if (hazard === "wind-gust") return "Researching NOAA wind-gust evidence";
  if (hazard === "snowfall") return "Researching NOAA snowfall evidence";
  return "Choose a risk to review NOAA evidence";
}

export function referencePointFor(market: AgriculturalMarket | undefined): ReferencePoint | null {
  if (!market || !Number.isFinite(market.latitude) || !Number.isFinite(market.longitude)
    || Math.abs(market.latitude) > 85 || Math.abs(market.longitude) > 180) return null;
  return {
    slug: market.slug,
    location: `${market.locality}, ${market.administrativeArea}, ${market.country}`,
    latitude: market.latitude,
    longitude: market.longitude,
    zoom: market.mapZoom ?? 10,
  };
}

export function mapTilerStyleUrl(key: string | undefined): string | null {
  const trimmed = key?.trim();
  if (!trimmed) return null;
  return `https://api.maptiler.com/maps/dataviz-v4-dark/style.json?key=${encodeURIComponent(trimmed)}`;
}

export function openStreetMapUrl(point: ReferencePoint): string {
  const latitude = point.latitude.toFixed(5);
  const longitude = point.longitude.toFixed(5);
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=${point.zoom}/${latitude}/${longitude}`;
}
