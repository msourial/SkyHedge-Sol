import { DataUnavailableError, parseNoaaDailyRainfall } from "./noaa.js";
import { PERILS, type PerilId, type PerilSpec } from "../../shared/perils.js";

export interface DailyObservation {
  date: string;
  /** Native unit after GHCN scaling: mm, m/s, or degrees C. */
  value: number;
  measurementFlag: string | null;
  qualityFlag: string | null;
}

export interface DlyDay {
  date: string;
  /** Null when GHCN-Daily stored the missing sentinel -9999. */
  raw: number | null;
  measurementFlag: string;
  qualityFlag: string;
  sourceFlag: string;
}

const MISSING = -9999;

/** Read one GHCN-Daily element from a .dly station file. Values stay as published integers. */
export function parseDlyElement(raw: string, stationId: string, element: string): DlyDay[] {
  const id = stationId.replace(/^GHCND:/, "");
  if (!/^[A-Z0-9]{11}$/.test(id) || !/^[A-Z0-9]{4}$/.test(element)) {
    throw new DataUnavailableError("A NOAA station id and GHCN element are required");
  }
  const days: DlyDay[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line) continue;
    if (line.slice(0, 11) !== id || line.slice(17, 21) !== element) continue;
    if (line.length < 21 + 31 * 8) throw new DataUnavailableError("The NOAA daily source record is malformed");
    const year = Number(line.slice(11, 15));
    const month = Number(line.slice(15, 17));
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new DataUnavailableError("The NOAA daily source date is malformed");
    }
    for (let day = 1; day <= 31; day++) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const time = Date.parse(`${date}T00:00:00Z`);
      if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) continue;
      const offset = 21 + (day - 1) * 8;
      const token = line.slice(offset, offset + 5).trim();
      const value = Number(token);
      if (!/^-?\d+$/.test(token) || !Number.isInteger(value)) throw new DataUnavailableError("A NOAA daily value is malformed");
      days.push({
        date,
        raw: value === MISSING ? null : value,
        measurementFlag: line[offset + 5]?.trim() ?? "",
        qualityFlag: line[offset + 6]?.trim() ?? "",
        sourceFlag: line[offset + 7]?.trim() ?? "",
      });
    }
  }
  return days;
}

/**
 * CDO v2 record in metric units. Rain delegates to the existing precipitation
 * parser so its flag rules stay the ones already shipped.
 */
export function parseCdoObservation(peril: PerilId, record: { date?: unknown; value?: unknown; attributes?: unknown }): DailyObservation {
  if (peril === "rain") {
    const parsed = parseNoaaDailyRainfall(record);
    return { date: parsed.date, value: parsed.millimeters, measurementFlag: parsed.measurementFlag ?? null, qualityFlag: parsed.qualityFlag ?? null };
  }
  const spec = PERILS[peril];
  if (!spec.open || !spec.ghcndElement) throw new DataUnavailableError(spec.closedReason ?? "This peril is not open");
  if (typeof record.date !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(record.date) || !Number.isFinite(record.value)) {
    throw new DataUnavailableError("NOAA returned a malformed daily observation");
  }
  if (!spec.allowNegativeDaily && (record.value as number) < 0) {
    throw new DataUnavailableError("NOAA returned a negative daily observation");
  }
  if (typeof record.attributes !== "string") throw new DataUnavailableError("NOAA omitted GHCN-Daily quality attributes");
  const flags = record.attributes.split(",");
  if (flags.length !== 4) throw new DataUnavailableError("NOAA returned malformed GHCN-Daily quality attributes");
  return acceptFlags(spec, record.date.slice(0, 10), record.value as number, flags[0] ?? "", flags[1] ?? "");
}

/** Convert one GHCN-Daily integer into the peril's native unit, or throw. */
export function nativeFromDly(peril: PerilId, day: DlyDay): number | null {
  const spec = PERILS[peril];
  if (!spec.open || !spec.ghcndElement) throw new DataUnavailableError(spec.closedReason ?? "This peril is not open");
  if (day.raw == null) return null;
  if (!spec.allowNegativeDaily && day.raw < 0) throw new DataUnavailableError(`NOAA ${spec.ghcndElement} is invalid for ${day.date}`);
  const native = day.raw / spec.ghcnDivisor;
  acceptFlags(spec, day.date, native, day.measurementFlag, day.qualityFlag);
  return native;
}

/**
 * Half-open UTC window. A missing day, a failed quality flag, or a disallowed
 * measurement flag throws. Nothing is filled with zero.
 * The return is integer tenths of the native unit.
 */
export function aggregateWindowTenths(peril: PerilId, days: readonly DlyDay[], start: string, endExclusive: string): number {
  const spec = PERILS[peril];
  if (!spec.open) throw new DataUnavailableError(spec.closedReason ?? "This peril is not open");
  const byDate = new Map(days.map((day) => [day.date, day]));
  const values: number[] = [];
  for (const date of utcDates(start, endExclusive)) {
    const day = byDate.get(date);
    if (!day) throw new DataUnavailableError(`NOAA ${spec.ghcndElement} is missing for ${date}`);
    const native = nativeFromDly(peril, day);
    if (native == null) throw new DataUnavailableError(`NOAA ${spec.ghcndElement} is missing for ${date}`);
    values.push(native);
  }
  return tenthsOf(spec, aggregateNative(spec, values));
}

/** Same window rules as aggregateWindowTenths, for observations already in native units. */
export function aggregateObservationTenths(peril: PerilId, days: readonly DailyObservation[], start: string, endExclusive: string): number {
  const spec = PERILS[peril];
  if (!spec.open) throw new DataUnavailableError(spec.closedReason ?? "This peril is not open");
  const byDate = new Map<string, DailyObservation>();
  for (const day of days) {
    if (byDate.has(day.date)) throw new DataUnavailableError("NOAA returned a duplicate daily observation");
    byDate.set(day.date, day);
  }
  const values: number[] = [];
  for (const date of utcDates(start, endExclusive)) {
    const day = byDate.get(date);
    if (!day) throw new DataUnavailableError(`NOAA ${spec.ghcndElement} is missing for ${date}`);
    if (!spec.allowNegativeDaily && day.value < 0) throw new DataUnavailableError(`NOAA ${spec.ghcndElement} is invalid for ${date}`);
    values.push(day.value);
  }
  return tenthsOf(spec, aggregateNative(spec, values));
}

export function aggregateNative(spec: Pick<PerilSpec, "aggregator">, values: readonly number[]): number {
  if (!values.length) throw new DataUnavailableError("NOAA returned no daily observations");
  if (spec.aggregator === "max") return Math.max(...values);
  return values.reduce((total, value) => total + value, 0);
}

export function tenthsOf(spec: Pick<PerilSpec, "id" | "ghcnDivisor">, native: number): number {
  const tenths = Math.round(native * 10);
  if (!Number.isInteger(tenths)) throw new DataUnavailableError("NOAA observation could not be scaled");
  return tenths;
}

function acceptFlags(spec: PerilSpec, date: string, native: number, measurement: string, quality: string): DailyObservation {
  if (quality.trim()) throw new DataUnavailableError(`NOAA ${spec.ghcndElement} failed quality flag ${quality.trim()} on ${date}`);
  const flag = measurement.trim();
  if (flag && !spec.measurementFlags.includes(flag)) {
    throw new DataUnavailableError(`NOAA ${spec.ghcndElement} has unsupported measurement flag ${flag} on ${date}`);
  }
  if (!Number.isFinite(native)) throw new DataUnavailableError(`NOAA ${spec.ghcndElement} is invalid for ${date}`);
  return { date, value: native, measurementFlag: flag || null, qualityFlag: null };
}

export function utcDates(start: string, endExclusive: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(endExclusive) || start >= endExclusive) {
    throw new DataUnavailableError("NOAA observation window is invalid");
  }
  const dates: string[] = [];
  for (let date = start; date < endExclusive;) {
    dates.push(date);
    const next = new Date(`${date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    date = next.toISOString().slice(0, 10);
  }
  if (dates.length > 366) throw new DataUnavailableError("NOAA observation window exceeds the supported maximum");
  return dates;
}
