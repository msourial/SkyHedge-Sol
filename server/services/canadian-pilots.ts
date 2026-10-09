import { DataUnavailableError } from "./noaa.js";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

function exactIso(instant: string): number {
  const value = Date.parse(instant);
  const canonical = Number.isFinite(value) ? new Date(value).toISOString() : "";
  if (canonical !== instant && canonical.replace(".000Z", "Z") !== instant) throw new DataUnavailableError("An exact ISO UTC timestamp is required");
  return value;
}

function exactDate(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new DataUnavailableError("A calendar date in YYYY-MM-DD form is required");
  const value = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== date) throw new DataUnavailableError("The calendar date is invalid");
  return value;
}

/** Five *full* UTC observation days, never a rolling 120-hour partial-day window. */
export function fiveDaySaskatoonWindow(salesStart: string) {
  const salesClose = exactIso(salesStart) + DAY_MS;
  const observationStart = Math.ceil(salesClose / DAY_MS) * DAY_MS;
  return {
    salesCloseAt: new Date(salesClose).toISOString(),
    observationStart: new Date(observationStart).toISOString(),
    observationEnd: new Date(observationStart + 5 * DAY_MS).toISOString(),
  };
}

/** The proposed trigger is reviewed by an admin; this function never activates a market. */
export function saskatoonTriggerFromTen(historicalTotalsMm: readonly number[]): number {
  if (historicalTotalsMm.length !== 10) throw new DataUnavailableError("Exactly ten analogous historical windows are required");
  if (historicalTotalsMm.some((total) => !Number.isFinite(total) || total < 0)) throw new DataUnavailableError("All ten historical rainfall totals must be valid");
  return [...historicalTotalsMm].sort((left, right) => left - right)[1];
}

function torontoParts(instant: number) {
  const values = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const part = (type: string) => Number(values.find((value) => value.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day"), hour: part("hour"), minute: part("minute"), second: part("second") };
}

function torontoMidnight(date: string): number {
  const localMidnightAsUtc = exactDate(date);
  let guess = localMidnightAsUtc;
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = torontoParts(guess);
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const difference = localMidnightAsUtc - represented;
    guess += difference;
    if (difference === 0) break;
  }
  const verified = torontoParts(guess);
  if (`${verified.year}-${String(verified.month).padStart(2, "0")}-${String(verified.day).padStart(2, "0")}` !== date || verified.hour !== 0 || verified.minute !== 0 || verified.second !== 0) {
    throw new DataUnavailableError("Toronto local-day boundary could not be resolved");
  }
  return guess;
}

/** The event index is one Toronto calendar day, which may be 23 or 25 hours. */
export function torontoLocalDayWindow(date: string) {
  const start = torontoMidnight(date);
  const nextDate = new Date(exactDate(date) + DAY_MS).toISOString().slice(0, 10);
  const end = torontoMidnight(nextDate);
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString(), hours: (end - start) / HOUR_MS };
}

export type HourlyRainfall = { start: string; end: string; millimeters: number; quality: "passed" | "failed" | "unavailable" };

/** No interpolation, presumed zero, overlaps, or partial local-day totals. */
export function completeHourlyRainfall(records: readonly HourlyRainfall[], windowStart: string, windowEnd: string): number {
  const start = exactIso(windowStart);
  const end = exactIso(windowEnd);
  if (start >= end || records.length === 0) throw new DataUnavailableError("The NOAA hourly rainfall window is incomplete");
  let cursor = start;
  let total = 0;
  for (const record of [...records].sort((left, right) => Date.parse(left.start) - Date.parse(right.start))) {
    if (record.quality !== "passed") throw new DataUnavailableError("NOAA hourly rainfall failed quality validation");
    const intervalStart = exactIso(record.start);
    const intervalEnd = exactIso(record.end);
    if (!Number.isFinite(record.millimeters) || record.millimeters < 0 || intervalEnd <= intervalStart) throw new DataUnavailableError("NOAA hourly rainfall contains a malformed value or interval");
    if (intervalEnd - intervalStart !== HOUR_MS) throw new DataUnavailableError("NOAA hourly rainfall must contain genuine one-hour intervals");
    if (intervalStart !== cursor || intervalEnd > end) throw new DataUnavailableError("NOAA hourly rainfall has a gap, overlap, or out-of-window interval; complete coverage is required");
    cursor = intervalEnd;
    total += record.millimeters;
  }
  if (cursor !== end) throw new DataUnavailableError("NOAA hourly rainfall does not cover the complete observation window");
  return Math.round(total * 100) / 100;
}

export type ForecastRainfallInterval = { start: string; end: string; millimeters: number | null };

/** Validate already-decoded forecast intervals; this does not authenticate their NOAA origin. */
export function completeForecastRainfall(records: readonly ForecastRainfallInterval[], windowStart: string, windowEnd: string): number {
  const start = exactIso(windowStart);
  const end = exactIso(windowEnd);
  if (start >= end || records.length === 0) throw new DataUnavailableError("The NOAA forecast window is incomplete");
  const intervals = records.map((record) => {
    if (!record || typeof record !== "object") throw new DataUnavailableError("A decoded NOAA forecast interval is missing or malformed");
    const intervalStart = exactIso(record.start);
    const intervalEnd = exactIso(record.end);
    if (intervalEnd <= intervalStart || typeof record.millimeters !== "number" || !Number.isFinite(record.millimeters) || record.millimeters < 0) {
      throw new DataUnavailableError("A decoded NOAA forecast interval is missing or malformed");
    }
    return { start: intervalStart, end: intervalEnd, millimeters: record.millimeters };
  }).sort((left, right) => left.start - right.start);
  let cursor = start;
  let total = 0;
  for (const interval of intervals) {
    if (interval.end <= start || interval.start >= end) continue;
    if (interval.start < start || interval.end > end) throw new DataUnavailableError("The NOAA forecast does not align with the exact observation-window boundary");
    if (interval.start < cursor) throw new DataUnavailableError("NOAA forecast intervals overlap");
    if (interval.start > cursor) throw new DataUnavailableError("The NOAA forecast has a gap in its exact observation window");
    cursor = interval.end;
    total += interval.millimeters;
  }
  if (cursor !== end) throw new DataUnavailableError("The NOAA forecast does not completely cover the observation window");
  return Math.round(total * 100) / 100;
}

export type CanadianPilotActivationEvidence = {
  stationValidated: boolean;
  dataRightsConfirmed: boolean;
  tenHistoricalWindowsComplete: boolean;
  forecastWindowComplete: boolean;
  methodologyHash: string | null;
  sourceHash: string | null;
};

/** Research-only until every evidence and data-use gate is explicitly verified. */
export function canadianPilotActivationBlocker(evidence: CanadianPilotActivationEvidence): string | null {
  if (!evidence.dataRightsConfirmed) return "Canadian NOAA data-use rights are not confirmed for this service.";
  if (!evidence.stationValidated) return "A NOAA final-observation station has not been validated.";
  if (!evidence.tenHistoricalWindowsComplete) return "Ten complete analogous historical windows are not available.";
  if (!evidence.forecastWindowComplete) return "The NOAA forecast does not cover the exact immutable observation window.";
  if (!evidence.methodologyHash || !/^[a-f0-9]{64}$/i.test(evidence.methodologyHash)) return "A versioned methodology hash is missing.";
  if (!evidence.sourceHash || !/^[a-f0-9]{64}$/i.test(evidence.sourceHash)) return "The NOAA input source hash is missing.";
  return null;
}
