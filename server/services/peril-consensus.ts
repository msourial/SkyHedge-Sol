import { canonicalSourceHash, NOAA_STATIONS, type SkyHedgeCity } from "./noaa.js";
import { aggregateNative, tenthsOf, utcDates, type DailyObservation } from "./ghcnd-daily.js";
import { NoaaElementProvider } from "./noaa-element.js";
import { methodologyDocument } from "./methodology-docs.js";
import { PERILS, type PerilId } from "../../shared/perils.js";

export interface PerilConsensusResult {
  verdict: "AGREED";
  /** Native unit. Rain settlement does not use this service. */
  finalValue: number;
  finalScaledX100: number;
  evidence: {
    methodologyVersion: string;
    city: SkyHedgeCity;
    windowStart: string;
    windowEnd: string;
    noaa: { stationId: string; cumulativeMm: number; records: Array<{ date: string; millimeters: number }> };
    verdict: "AGREED";
    rule: "NOAA quality-screened daily observation";
    sourceHash: string;
    generatedAt: string;
  };
}

/**
 * Settlement evidence for snow, wind, and heat. Rain keeps RainfallConsensusService.
 * The observation committed on-chain is the aggregated native value × 100.
 */
export class PerilConsensusService {
  constructor(private readonly daily = new NoaaElementProvider()) {}

  async evidenceFor(city: SkyHedgeCity, peril: Exclude<PerilId, "rain" | "cold">, windowStart: string, windowEnd: string): Promise<PerilConsensusResult> {
    const spec = PERILS[peril];
    if (!spec.open || !spec.ghcndElement || !spec.methodologyVersion) {
      throw new Error(spec.closedReason ?? "This peril is not open");
    }
    // Rain settlement passes the last covered day. This service uses that same inclusive end.
    const endExclusive = nextUtcDate(windowEnd);
    const dates = utcDates(windowStart, endExclusive);
    const records = await this.daily.daily(peril, NOAA_STATIONS[city].stationId, windowStart, windowEnd);
    const byDate = new Map<string, DailyObservation>();
    for (const record of records) {
      if (byDate.has(record.date)) throw new Error("NOAA returned a duplicate daily observation.");
      byDate.set(record.date, record);
    }
    const values: number[] = [];
    const normalized: Array<{ date: string; millimeters: number }> = [];
    for (const date of dates) {
      const record = byDate.get(date);
      if (!record) throw new Error("NOAA quality-screened observations are incomplete for the requested window.");
      values.push(record.value);
      normalized.push({ date, millimeters: record.value });
    }
    if ([...byDate.keys()].some((date) => !dates.includes(date))) {
      throw new Error("NOAA returned an observation outside the requested window.");
    }
    const aggregate = aggregateNative(spec, values);
    if (!Number.isFinite(aggregate) || aggregate < 0) throw new Error("NOAA aggregate observation is not a non-negative value.");
    const scaled = tenthsOf(spec, aggregate) * 10;
    const version = methodologyDocument(peril).version;
    const evidence: PerilConsensusResult["evidence"] = {
      methodologyVersion: version,
      city,
      windowStart,
      windowEnd,
      noaa: { stationId: NOAA_STATIONS[city].stationId, cumulativeMm: aggregate, records: normalized },
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
    return { verdict: "AGREED", finalValue: aggregate, finalScaledX100: scaled, evidence };
  }
}

function nextUtcDate(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}
