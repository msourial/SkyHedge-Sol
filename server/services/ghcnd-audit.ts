import { createHash } from "node:crypto";
import { DataUnavailableError } from "./noaa.js";

const DAY_MS = 86_400_000;

export type RainfallAuditWindow = { start: string; endExclusive: string };
export type AuditedDailyRainfall = { date: string; millimeters: number; sourceFlag: string };

function utcDate(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new DataUnavailableError("An exact NOAA calendar date is required");
  const time = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) throw new DataUnavailableError("The NOAA calendar date is invalid");
  return time;
}

/** Audit GHCN-Daily's fixed-width PRCP fields, not station-inventory presence. */
export function auditGhcndRainfallWindows(raw: string, stationId: string, windows: readonly RainfallAuditWindow[]) {
  if (!/^[A-Z0-9]{11}$/.test(stationId) || windows.length === 0) throw new DataUnavailableError("A NOAA station and at least one rainfall window are required");
  const byDate = new Map<string, AuditedDailyRainfall & { measurementFlag: string; qualityFlag: string }>();
  for (const line of raw.split(/\r?\n/)) {
    if (line.slice(0, 11) !== stationId || line.slice(17, 21) !== "PRCP") continue;
    if (line.length < 21 + 31 * 8) throw new DataUnavailableError("The NOAA PRCP source record is malformed");
    const year = Number(line.slice(11, 15));
    const month = Number(line.slice(15, 17));
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) throw new DataUnavailableError("The NOAA PRCP source date is malformed");
    for (let day = 1; day <= 31; day++) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const time = Date.parse(`${date}T00:00:00Z`);
      if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) continue;
      const offset = 21 + (day - 1) * 8;
      const rawValue = line.slice(offset, offset + 5);
      const value = Number(rawValue.trim());
      if (!/^-?\d+$/.test(rawValue.trim()) || !Number.isInteger(value)) throw new DataUnavailableError("A NOAA PRCP value is malformed");
      if (byDate.has(date)) throw new DataUnavailableError("The NOAA PRCP source has a duplicate date");
      byDate.set(date, {
        date,
        millimeters: value / 10,
        measurementFlag: line[offset + 5].trim(),
        qualityFlag: line[offset + 6].trim(),
        sourceFlag: line[offset + 7].trim(),
      });
    }
  }

  const records: AuditedDailyRainfall[] = [];
  const totalsMm: number[] = [];
  for (const window of windows) {
    const start = utcDate(window.start);
    const end = utcDate(window.endExclusive);
    if (end <= start || (end - start) / DAY_MS > 366) throw new DataUnavailableError("The NOAA rainfall window is invalid");
    let total = 0;
    for (let time = start; time < end; time += DAY_MS) {
      const date = new Date(time).toISOString().slice(0, 10);
      const record = byDate.get(date);
      if (!record || record.millimeters === -999.9) throw new DataUnavailableError(`NOAA PRCP is missing for ${date}`);
      if (record.qualityFlag) throw new DataUnavailableError(`NOAA PRCP quality flag ${record.qualityFlag} blocks ${date}`);
      if (record.measurementFlag) throw new DataUnavailableError(`NOAA PRCP measurement flag ${record.measurementFlag} requires methodology review for ${date}`);
      if (record.millimeters < 0) throw new DataUnavailableError(`NOAA PRCP is invalid for ${date}`);
      total += record.millimeters;
      records.push({ date, millimeters: record.millimeters, sourceFlag: record.sourceFlag });
    }
    totalsMm.push(Math.round(total * 100) / 100);
  }
  const sourceHash = createHash("sha256").update(JSON.stringify({ stationId, windows, records })).digest("hex");
  return { stationId, windows, totalsMm, records, sourceHash };
}
