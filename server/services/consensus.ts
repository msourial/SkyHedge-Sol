import { canonicalSourceHash, NoaaRainfallProvider, NOAA_STATIONS, cumulativeMillimeters, type DailyRainfall, type SkyHedgeCity } from "./noaa";
import { loadMethodology } from "./methodology";

const methodology = loadMethodology();

export type ConsensusVerdict = "AGREED" | "DATA_UNAVAILABLE";

/**
 * Immutable single-source settlement proof for V1. NOAA is the sole source of
 * final rainfall data; a missing or malformed response never becomes a
 * synthetic observation.
 */
export interface ConsensusEvidence {
  methodologyVersion: string;
  city: SkyHedgeCity;
  windowStart: string;
  windowEnd: string;
  noaa: { stationId: string; cumulativeMm: number; records: DailyRainfall[] };
  verdict: ConsensusVerdict;
  rule: "NOAA final observation";
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
    const records = await this.noaa.dailyRainfall(NOAA_STATIONS[city].stationId, windowStart, windowEnd);
    const evidence: ConsensusEvidence = {
      methodologyVersion: methodology.version,
      city,
      windowStart,
      windowEnd,
      noaa: { stationId: NOAA_STATIONS[city].stationId, cumulativeMm: round(cumulativeMillimeters(records)), records },
      verdict: "AGREED",
      rule: "NOAA final observation",
      sourceHash: "",
      generatedAt: new Date().toISOString(),
    };
    evidence.sourceHash = canonicalSourceHash(evidence);
    return { verdict: "AGREED", finalValueMm: evidence.noaa.cumulativeMm, evidence };
  }

  sourceHashFor(result: ConsensusResult): string { return result.evidence.sourceHash; }
}

function round(value: number): number { return Math.round(value * 100) / 100; }
