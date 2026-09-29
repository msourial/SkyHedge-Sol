import { canonicalSourceHash, NoaaRainfallProvider, NOAA_STATIONS, cumulativeMillimeters, type DailyRainfall, type SkyHedgeCity } from "./noaa.js";
import { loadMethodology } from "./methodology.js";

const methodology = loadMethodology();

export type ConsensusVerdict = "AGREED" | "DATA_UNAVAILABLE";

/**
 * Immutable single-source settlement evidence for V1. NOAA is the sole source
 * and its daily quality attributes are checked. A missing, malformed, or
 * quality-flagged response never becomes a synthetic observation. A blank
 * NOAA quality flag is not a guarantee that NOAA will never revise a record.
 */
export interface ConsensusEvidence {
  methodologyVersion: string;
  city: SkyHedgeCity;
  windowStart: string;
  windowEnd: string;
  noaa: { stationId: string; cumulativeMm: number; records: DailyRainfall[] };
  verdict: ConsensusVerdict;
  rule: "NOAA quality-screened daily observation";
  sourceHash: string;
  generatedAt: string;
}

export interface ConsensusResult {
  verdict: ConsensusVerdict;
  finalValueMm: number | null;
  evidence: ConsensusEvidence;
}

export class RainfallConsensusService {
  constructor(private readonly noaa = new NoaaRainfallProvider()) {}

  async evidenceFor(city: SkyHedgeCity, windowStart: string, windowEnd: string): Promise<ConsensusResult> {
    const expectedDates = dailyDatesInclusive(windowStart, windowEnd);
    const records = validateFinalDailyRecords(
      await this.noaa.dailyRainfall(NOAA_STATIONS[city].stationId, windowStart, windowEnd),
      expectedDates,
    );
    const evidence: ConsensusEvidence = {
      methodologyVersion: methodology.version,
      city,
      windowStart,
      windowEnd,
      noaa: { stationId: NOAA_STATIONS[city].stationId, cumulativeMm: round(cumulativeMillimeters(records)), records },
      verdict: "AGREED",
      rule: "NOAA quality-screened daily observation",
      sourceHash: "",
      generatedAt: new Date().toISOString(),
    };
    evidence.sourceHash = canonicalSourceHash({
      methodologyVersion: evidence.methodologyVersion,
      city: evidence.city,
      windowStart: evidence.windowStart,
      windowEnd: evidence.windowEnd,
      noaa: evidence.noaa,
      verdict: evidence.verdict,
      rule: evidence.rule,
    });
    return { verdict: "AGREED", finalValueMm: evidence.noaa.cumulativeMm, evidence };
  }

  sourceHashFor(result: ConsensusResult): string { return result.evidence.sourceHash; }
}

function round(value: number): number { return Math.round(value * 100) / 100; }

/** Returns UTC calendar dates covered by the market's half-open [start, end) window. */
export function utcDailyObservationRange(startSeconds: number, endSeconds: number): { start: string; end: string } {
  if (!Number.isSafeInteger(startSeconds) || !Number.isSafeInteger(endSeconds) || startSeconds >= endSeconds) {
    throw new Error("Market observation window is invalid.");
  }
  const start = new Date(startSeconds * 1_000).toISOString().slice(0, 10);
  const lastCoveredSecond = endSeconds - 1;
  const end = new Date(lastCoveredSecond * 1_000).toISOString().slice(0, 10);
  return { start, end };
}

function dailyDatesInclusive(start: string, end: string): string[] {
  const startMs = parseUtcDate(start);
  const endMs = parseUtcDate(end);
  if (startMs > endMs) throw new Error("NOAA observation window is invalid.");
  const dayCount = Math.floor((endMs - startMs) / 86_400_000) + 1;
  if (dayCount > 366) throw new Error("NOAA observation window exceeds the supported maximum.");
  return Array.from({ length: dayCount }, (_, index) => new Date(startMs + index * 86_400_000).toISOString().slice(0, 10));
}

function parseUtcDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("NOAA observation window must use YYYY-MM-DD dates.");
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) {
    throw new Error("NOAA observation window contains an invalid date.");
  }
  return parsed;
}

function validateFinalDailyRecords(records: DailyRainfall[], expectedDates: string[]): DailyRainfall[] {
  if (!Array.isArray(records) || records.length === 0) throw new Error("NOAA returned no quality-screened observations for the pinned station/window.");
  const expected = new Set(expectedDates);
  const seen = new Set<string>();
  const normalized = records.map((record) => {
    if (!record || typeof record.date !== "string" || !Number.isFinite(record.millimeters) || record.millimeters < 0) {
      throw new Error("NOAA returned a malformed daily rainfall observation.");
    }
    if (record.qualityFlag) throw new Error(`NOAA precipitation failed quality flag ${record.qualityFlag}.`);
    if (record.measurementFlag && !["B", "D", "T"].includes(record.measurementFlag)) {
      throw new Error(`NOAA precipitation has unsupported measurement flag ${record.measurementFlag}.`);
    }
    if (!expected.has(record.date)) throw new Error("NOAA returned an observation outside the requested window.");
    if (seen.has(record.date)) throw new Error("NOAA returned a duplicate daily observation.");
    seen.add(record.date);
    return { date: record.date, millimeters: round(record.millimeters) };
  }).sort((a, b) => a.date.localeCompare(b.date));
  if (seen.size !== expected.size || expectedDates.some((date) => !seen.has(date))) {
    throw new Error("NOAA quality-screened observations are incomplete for the requested window.");
  }
  return normalized;
}
