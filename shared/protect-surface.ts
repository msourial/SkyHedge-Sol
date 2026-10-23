/**
 * Protect screen states. A failed read is not a closed window, and an empty
 * gauge is never a stand-in for a price.
 */
import { consumerCityName } from "./consumer-cities.js";
import { openWeeklyWindows } from "./window-ladder.js";

export type ProtectSurface = "loading" | "error" | "closed" | "ready";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function protectSurface(input: { loading: boolean; failed: boolean; openWindowCount: number }): ProtectSurface {
  if (input.loading) return "loading";
  if (input.failed) return "error";
  if (input.openWindowCount === 0) return "closed";
  return "ready";
}

/** The buy bar is only for a window that already has a price. */
export function buyCtaVisible(surface: ProtectSurface, priced: boolean): boolean {
  return surface === "ready" && priced;
}

/** Amount chips stay unselected until something is priced. 50 SKYT is not a default. */
export function coverageChipOn(priced: boolean, chipId: string, selectedId: string | null): boolean {
  return priced && selectedId != null && chipId === selectedId;
}

export function gaugeMode(input: { surface: ProtectSurface; evidenceLoading: boolean; pricedRowCount: number }): "skeleton" | "gauge" | "hidden" {
  if (input.surface === "loading" || (input.surface === "ready" && input.evidenceLoading)) return "skeleton";
  if (input.surface === "ready" && input.pricedRowCount > 0) return "gauge";
  return "hidden";
}

/** Next weekly open on the ladder clock. Null only when that instant is missing. */
export function nextWeeklyOpenCopy(citySlug: string, nowSeconds: number): string | null {
  const start = openWeeklyWindows(nowSeconds, 1)[0]?.observationStart;
  if (!start) return null;
  return `${consumerCityName(citySlug)}'s next weekly window opens ${formatUtc(start)}`;
}

/** A link only when some other city in this read is actually selling. */
export function openCityPrompt(openWindows: readonly { city: string }[], currentSlug: string): { slug: string; label: string } | null {
  const other = openWindows.find((window) => window.city !== currentSlug);
  if (!other) return null;
  return { slug: other.city, label: `${consumerCityName(other.city)} is open now` };
}

function formatUtc(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1_000);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${hours}:${minutes} UTC`;
}

/**
 * What the water in the gauge means. It is never a decorative level: it is the NOAA analogue
 * forecast for this window when the evidence package has one, otherwise empty and labelled so.
 */
export function gaugeReading(input: { forecastMm: number | null | undefined; observationStart: number | null | undefined; nowSeconds: number; startLabel: string | null }): { levelMm: number; caption: string } {
  if (input.forecastMm != null && Number.isFinite(input.forecastMm) && input.forecastMm >= 0) {
    const mm = Math.round(input.forecastMm * 10) / 10;
    return { levelMm: mm, caption: `Water = ${mm} mm NOAA forecast` };
  }
  if (input.observationStart && input.nowSeconds < input.observationStart) {
    return { levelMm: 0, caption: input.startLabel ? `Empty until rain counts from ${input.startLabel}` : "Empty until the window starts" };
  }
  return { levelMm: 0, caption: "Rain so far settles from NOAA final data" };
}
