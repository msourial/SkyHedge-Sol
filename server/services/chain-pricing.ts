import { DataUnavailableError, NoaaRainfallProvider, cumulativeMillimeters, type DailyRainfall } from "./noaa";
import { windowNormalMm, upcomingWeeklyWindows, type CityIndex } from "../../shared/cities";

export type ChainSide = "call" | "put";

export interface ChainPrice {
  probabilityBps: number;
  probabilitySource: "noaa-10yr" | "climatology-prior";
  modelVersion: "noaa-10yr-v1" | "rain-gamma-v1";
  premiumRateBps: number;
  normalMm: number;
  historicalWindows: number;
}

export interface ChainWindow { start: Date; end: Date; }

/** Weekly rainfall CV used by the climatology prior (typical for weekly totals). */
const WEEKLY_CV = 0.45;

const provider = new NoaaRainfallProvider();
const cache = new Map<string, { at: number; value: DailyRainfall[] | null }>();
const CACHE_TTL_MS = 10 * 60_000;

async function analogueWindow(stationId: string, start: Date, end: Date, yearsAgo: number): Promise<DailyRainfall[] | null> {
  const shifted = (d: Date): string => {
    const c = new Date(d);
    c.setUTCFullYear(c.getUTCFullYear() - yearsAgo);
    return c.toISOString().slice(0, 10);
  };
  const key = `${stationId}|${shifted(start)}|${shifted(end)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  let value: DailyRainfall[] | null;
  try {
    value = await provider.dailyRainfall(stationId, shifted(start), shifted(end));
  } catch (err) {
    if (err instanceof DataUnavailableError) value = null;
    else throw err;
  }
  cache.set(key, { at: Date.now(), value });
  return value;
}

/**
 * Price a binary option on the city's weekly rainfall index.
 *  - With a NOAA token: empirical probability from the same window in the last
 *    10 years (>=8 of 10 analogues) -> source "noaa-10yr".
 *  - Otherwise: climatology prior - weekly total ~ Gamma(shape, scale) fit to
 *    the window normal with CV 0.45 -> source "climatology-prior".
 * Premium mirrors the quote engine: probability x 1.15 loading + 100 bps fee.
 */
export async function priceChainOption(city: CityIndex, window: ChainWindow, strikeMm: number, side: ChainSide): Promise<ChainPrice> {
  const normalMm = windowNormalMm(city, window.start.getTime(), window.end.getTime());

  const analogues: number[] = [];
  for (let year = 1; year <= 10; year++) {
    const records = await analogueWindow(city.noaaStationId, window.start, window.end, year);
    if (records) analogues.push(cumulativeMillimeters(records));
  }

  if (analogues.length >= 8) {
    const hits = side === "call"
      ? analogues.filter((mm) => mm >= strikeMm).length
      : analogues.filter((mm) => mm <= strikeMm).length;
    const probabilityBps = clamp(Math.round((hits / analogues.length) * 10_000), 100, 9_000);
    return {
      probabilityBps,
      probabilitySource: "noaa-10yr",
      modelVersion: "noaa-10yr-v1",
      premiumRateBps: premiumBps(probabilityBps),
      normalMm,
      historicalWindows: analogues.length,
    };
  }

  const shape = 1 / (WEEKLY_CV * WEEKLY_CV);
  const scale = Math.max(normalMm / shape, 0.5);
  const cdf = regularizedGammaP(shape, Math.max(strikeMm, 0) / scale);
  const probabilityBps = clamp(Math.round((side === "call" ? 1 - cdf : cdf) * 10_000), 100, 9_000);
  return {
    probabilityBps,
    probabilitySource: "climatology-prior",
    modelVersion: "rain-gamma-v1",
    premiumRateBps: premiumBps(probabilityBps),
    normalMm,
    historicalWindows: 0,
  };
}

export function premiumBps(probabilityBps: number): number {
  return Math.ceil((probabilityBps * 11_500) / 10_000) + 100;
}

export function strikeSetFor(normalMm: number): number[] {
  const raw = [0.5, 0.75, 1.0, 1.25, 1.5].map((f) => Math.max(5, Math.round((normalMm * f) / 5) * 5));
  return [...new Set(raw)];
}

export function chainWindowsFrom(from: Date, count: number): ChainWindow[] {
  return upcomingWeeklyWindows(from, count).map((w) => ({ start: w.start, end: w.end }));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

/** Regularized lower incomplete gamma P(a, x) via series + continued fraction (Lentz). */
function regularizedGammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let sum = 1 / a;
    let term = sum;
    for (let n = 1; n < 200; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < 1e-14 * sum) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  const b0 = x + 1 - a;
  let c = 1 / 1e-30;
  let d = 1 / b0;
  let h = d;
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a);
    d = an * d + b0 + 2 * i;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b0 + 2 * i + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

function logGamma(x: number): number {
  const coeffs = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += coeffs[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}