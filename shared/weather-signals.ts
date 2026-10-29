/** Read-only weather signals. Windows use the market's half-open [start, end) dates. */
export type WeatherUnit = "mm" | "cm" | "m/s" | "°C";
export interface CoverProgress {
  valueNative: number | null;
  unit: WeatherUnit;
  observedThrough: string | null;
  daysReported: number;
  daysTotal: number;
  complete: boolean;
  state: "not_started" | "tracking" | "ended_waiting" | "complete" | "unavailable";
  source: string;
  reason?: string;
  fetchedAt: string;
}
export interface ForecastExceedance {
  probability: number;
  /** Members satisfying the market operator; normally >=, also supports gt/lt/lte. */
  membersAtOrAbove: number;
  membersTotal: number;
  model: "NOAA GEFS (gfs_seamless) via Open-Meteo Ensemble API";
  source: "NOAA GEFS ensemble";
  /** Open-Meteo does not publish model initialization time in this response. */
  issuedAt: string | null;
  fetchedAt: string;
  windowStart: string;
  windowEnd: string;
  trigger: number;
  unit: WeatherUnit;
}
export interface ForecastEdge {
  forecast: ForecastExceedance | null;
  /** Probability (0..1) pinned from history, never the ensemble signal. */
  historyProbability: number;
}
export interface CoverProgressResponse { progress: Record<string, CoverProgress | null>; }
export interface ForecastEdgeResponse { edges: Record<string, ForecastEdge>; }

/** Inputs are percentages, and points is a signed percentage-point difference. */
export function edgeChip(forecastPct: number | null, historyPct: number | null): { points: number; sign: "pos" | "neg" } | null {
  if (forecastPct == null || historyPct == null || !Number.isFinite(forecastPct) || !Number.isFinite(historyPct)
    || forecastPct < 0 || forecastPct > 100 || historyPct < 0 || historyPct > 100) return null;
  const points = forecastPct - historyPct;
  return Math.abs(points) < 5 ? null : { points, sign: points > 0 ? "pos" : "neg" };
}
