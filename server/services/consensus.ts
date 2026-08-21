import { canonicalSourceHash, DataUnavailableError, NoaaRainfallProvider, NOAA_STATIONS, cumulativeMillimeters, type DailyRainfall, type SkyHedgeCity } from "./noaa";
import { WeatherXmClient, type WxmStation } from "./weatherxm";
import { loadMethodology } from "./methodology";

const methodology = loadMethodology();

export const CONSENSUS_RULE = methodology.consensus as { agreementToleranceMm: number; agreementTolerancePct: number };

export type ConsensusVerdict = "AGREED" | "DISAGREED" | "DATA_UNAVAILABLE" | "WXM_NOT_CONFIGURED";

export interface ConsensusEvidence {
  methodologyVersion: string;
  city: SkyHedgeCity;
  windowStart: string;
  windowEnd: string;
  noaa: { stationId: string; cumulativeMm: number; records: DailyRainfall[] };
  wxm: { cumulativeMm: number | null; stations: WxmStation[]; perStationMm: Array<{ stationId: string; millimeters: number }> };
  deltaMm: number | null;
  toleranceMm: number | null;
  verdict: ConsensusVerdict;
  rule: string;
  sourceHash: string;
  generatedAt: string;
}

export interface ConsensusResult {
  verdict: ConsensusVerdict;
  finalValueMm: number | null;
  evidence: ConsensusEvidence;
}

/** Deterministic 2-of-2 rule: agree iff |NOAA − WXM| ≤ max(5mm, 15% of NOAA). */
export function agree(noaaMm: number, wxmMm: number): boolean {
  const tolerance = Math.max(CONSENSUS_RULE.agreementToleranceMm, CONSENSUS_RULE.agreementTolerancePct * noaaMm);
  return Math.abs(noaaMm - wxmMm) <= tolerance;
}

/**
 * Builds the composite evidence bundle for a settlement window. NOAA is final;
 * WXM verifies. Persistent disagreement or any source failure → DATA_UNAVAILABLE.
 * Never synthesizes a value.
 */
export class RainfallConsensusService {
  constructor(
    private readonly noaa = new NoaaRainfallProvider(),
    private readonly wxm = new WeatherXmClient(),
  ) {}

  async evidenceFor(city: SkyHedgeCity, windowStart: string, windowEnd: string): Promise<ConsensusResult> {
    const noaaRecords = await this.noaa.dailyRainfall(NOAA_STATIONS[city].stationId, windowStart, windowEnd);
    const noaaMm = cumulativeMillimeters(noaaRecords);
    const evidence: ConsensusEvidence = {
      methodologyVersion: methodology.version,
      city,
      windowStart,
      windowEnd,
      noaa: { stationId: NOAA_STATIONS[city].stationId, cumulativeMm: round(noaaMm), records: noaaRecords },
      wxm: { cumulativeMm: null, stations: [], perStationMm: [] },
      deltaMm: null,
      toleranceMm: null,
      verdict: "WXM_NOT_CONFIGURED",
      rule: `${CONSENSUS_RULE.agreementToleranceMm}mm or ${CONSENSUS_RULE.agreementTolerancePct * 100}% of NOAA`,
      sourceHash: "",
      generatedAt: new Date().toISOString(),
    };

    if (!this.wxm.configured()) {
      evidence.sourceHash = canonicalSourceHash(evidence);
      return { verdict: "WXM_NOT_CONFIGURED", finalValueMm: null, evidence };
    }

    try {
      const wxm = await this.wxm.cityRainfall(city, windowStart, windowEnd);
      const delta = Math.abs(noaaMm - wxm.cumulativeMm);
      const tolerance = Math.max(CONSENSUS_RULE.agreementToleranceMm, CONSENSUS_RULE.agreementTolerancePct * noaaMm);
      evidence.wxm = { cumulativeMm: round(wxm.cumulativeMm), stations: wxm.stations, perStationMm: wxm.daily.map((entry) => ({ stationId: entry.stationId, millimeters: entry.millimeters })) };
      evidence.deltaMm = round(delta);
      evidence.toleranceMm = round(tolerance);
      evidence.verdict = delta <= tolerance ? "AGREED" : "DISAGREED";
      evidence.sourceHash = canonicalSourceHash(evidence);
      return { verdict: evidence.verdict, finalValueMm: evidence.verdict === "AGREED" ? round(noaaMm) : null, evidence };
    } catch (error) {
      if (error instanceof DataUnavailableError) {
        evidence.verdict = "DATA_UNAVAILABLE";
        evidence.sourceHash = canonicalSourceHash(evidence);
        return { verdict: "DATA_UNAVAILABLE", finalValueMm: null, evidence };
      }
      throw error;
    }
  }

  /** Composite source hash for the on-chain SettlementObservation commit. */
  sourceHashFor(result: ConsensusResult): string {
    return result.evidence.sourceHash;
  }
}

function round(value: number): number { return Math.round(value * 100) / 100; }

export function sourceHashBytes(hash: string): number[] {
  return Array.from(Buffer.from(hash, "hex"));
}