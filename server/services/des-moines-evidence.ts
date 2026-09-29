import methodology from "../../shared/methodology-v1.json" with { type: "json" };
import { RainfallConsensusService } from "./consensus.js";
import { canonicalSourceHash, NOAA_STATIONS, NoaaRainfallProvider } from "./noaa.js";
import { desMoinesSeedSchedule } from "../../shared/market-schedule.js";
import { RainfallQuoteEngine } from "./quote-engine.js";

export type EvidenceWindow = { start: string; end: string };

export type DesMoinesEvidencePackage = {
  validated: true;
  stationId: string;
  stationIdHash: string;
  providerHash: string;
  methodologyHash: string;
  /** Exact UTC timestamps submitted to create_market; never re-derived by the browser. */
  seedSchedule: { salesCloseAt: number; observationStart: number; observationEnd: number };
  /** Station validation alone is not pricing; these terms require exact-window NOAA QPF and historical inputs. */
  quoteTerms: null | { probabilityBps: number; premiumRateBps: number; inputsHash: string };
  evidence: { sourceHash: string; cumulativeMm: number | null; windowStart: string; windowEnd: string };
};

const EVIDENCE_CACHE_TTL_MS = 10 * 60_000;
const evidenceCache = new Map<string, { expiresAt: number; value: DesMoinesEvidencePackage }>();

/**
 * NOAA daily observations can arrive after the calendar day closes. Seeding
 * therefore uses a fully completed window, not the current or just-ended one.
 */
export function finalizedEvidenceWindow(now = new Date()): EvidenceWindow {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  end.setUTCDate(end.getUTCDate() - 7);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export async function getDesMoinesEvidencePackage(
  range = finalizedEvidenceWindow(),
  service = new RainfallConsensusService(),
  seedSchedule = desMoinesSeedSchedule(),
  quoteEngine = new RainfallQuoteEngine(new NoaaRainfallProvider()),
): Promise<DesMoinesEvidencePackage> {
  const permittedRange = finalizedEvidenceWindow();
  if (range.start !== permittedRange.start || range.end !== permittedRange.end) {
    throw new Error("Only the server-selected, completed Des Moines evidence window is permitted.");
  }
  // Quote inputs depend on the immutable observation dates, not the exact
  // second at which the 24-hour sales deadline is generated. Keying on dates
  // lets status polling and the seed action reuse one NOAA read package.
  const cacheKey = `${range.start}:${range.end}:${seedSchedule.observationStart}:${seedSchedule.observationEnd}`;
  const cached = evidenceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.value, seedSchedule };
  evidenceCache.clear();
  const station = NOAA_STATIONS["des-moines"];
  const evidence = await service.evidenceFor("des-moines", range.start, range.end);
  if (evidence.verdict !== "AGREED") {
    throw new Error("NOAA did not return a validated quality-screened observation package for Des Moines.");
  }
  if (evidence.evidence.city !== "des-moines"
    || evidence.evidence.windowStart !== range.start
    || evidence.evidence.windowEnd !== range.end
    || evidence.evidence.noaa.stationId !== station.stationId
    || evidence.evidence.noaa.cumulativeMm !== evidence.finalValueMm
    || !Number.isFinite(evidence.finalValueMm)
    || evidence.finalValueMm === null
    || !/^[a-f0-9]{64}$/i.test(evidence.evidence.sourceHash)) {
    throw new Error("NOAA returned malformed evidence; a finite rainfall total and 32-byte source hash are required.");
  }
  const quoteWindowStart = new Date(seedSchedule.observationStart * 1_000).toISOString().slice(0, 10);
  const quoteWindowEnd = new Date(seedSchedule.observationEnd * 1_000).toISOString().slice(0, 10);
  let quoteTerms: DesMoinesEvidencePackage["quoteTerms"] = null;
  try {
    const quote = await quoteEngine.quote({
      city: "des-moines",
      stationId: station.stationId,
      observationStart: quoteWindowStart,
      observationEnd: quoteWindowEnd,
      thresholdMm: 50,
      operator: "gte",
      // Market input commitment is independent of any individual tester's amount.
      protectedAmount: 1n,
    });
    quoteTerms = { probabilityBps: quote.probabilityBps, premiumRateBps: quote.premiumRateBps, inputsHash: quote.inputsHash };
  } catch {
    // Historical station validation remains distinct from future forecast coverage.
    // No incomplete or guessed quote terms can unlock market creation.
  }
  const value: DesMoinesEvidencePackage = {
    validated: true,
    stationId: station.stationId,
    stationIdHash: canonicalSourceHash(station.stationId),
    providerHash: canonicalSourceHash(methodology),
    methodologyHash: canonicalSourceHash(methodology.version),
    seedSchedule,
    quoteTerms,
    evidence: {
      sourceHash: evidence.evidence.sourceHash,
      cumulativeMm: evidence.finalValueMm,
      windowStart: range.start,
      windowEnd: range.end,
    },
  };
  // This is a real, source-hashed NOAA result from this process only. A cache
  // miss still performs a live NOAA read and surfaces DATA_UNAVAILABLE on failure.
  // Only the one server-selected window is eligible, so keep one cache entry.
  evidenceCache.set(cacheKey, { value, expiresAt: Date.now() + (quoteTerms ? EVIDENCE_CACHE_TTL_MS : 30_000) });
  return value;
}

/** Test support only; production cache entries always expire after ten minutes. */
export function clearDesMoinesEvidenceCache(): void {
  evidenceCache.clear();
}
