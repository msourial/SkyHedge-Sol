/**
 * Devnet-only ladder planner. Prices missing rungs from NOAA.
 * This file never creates a keypair and never signs.
 */
import { createHash } from "node:crypto";
import { canonicalSourceHash, NOAA_STATIONS, NoaaRainfallProvider } from "./noaa.js";
import { RainfallQuoteEngine } from "./quote-engine.js";
import { methodologyHashes } from "./methodology-docs.js";
import { perilCityHashInput, type PerilId } from "../../shared/perils.js";
import {
  historicHitBps,
  planCityLadders,
  priceFromHistory,
  strikeFromAnalogueTotals,
  type LadderMarketRef,
  type LadderStep,
  type LiveCitySlug,
} from "../../shared/window-ladder.js";

export const TEST_SKYT_MINT = "3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g";
export const DEVNET_RPC = "https://api.devnet.solana.com";

export type PricedLadderStep = LadderStep & {
  thresholdMm: number | null;
  scaledX100?: number;
  triggerValue?: number;
  peril?: PerilId;
  unit?: string;
  probabilityBps: number | null;
  premiumRateBps: number | null;
  forecastIncluded: boolean;
  inputsHash: string | null;
  stationId: string;
  skipReason: string | null;
};

export function assertDevnetKeeperTarget(rpcUrl: string, mint: string): void {
  const rpc = rpcUrl.toLowerCase();
  if (rpc.includes("mainnet") || !rpc.includes("devnet")) {
    throw new Error("Window keeper refuses any RPC that is not Solana Devnet.");
  }
  if (mint !== TEST_SKYT_MINT) throw new Error("Window keeper refuses any mint other than test SKYT.");
}

export function keeperPlan(
  markets: readonly LadderMarketRef[],
  nowSeconds = Math.floor(Date.now() / 1_000),
  cities?: readonly LiveCitySlug[],
): LadderStep[] {
  return planCityLadders(markets, nowSeconds, cities);
}

/** Price each missing rung from that city's NOAA station. A missing analogue year skips that rung. */
export async function priceKeeperSteps(steps: readonly LadderStep[], engine = new RainfallQuoteEngine(new NoaaRainfallProvider())): Promise<PricedLadderStep[]> {
  const priced: PricedLadderStep[] = [];
  for (const step of steps) {
    const city = step.city;
    if (!city || !(city in NOAA_STATIONS)) {
      priced.push(unpriced(step, "unknown", "Ladder step is missing a live NOAA city."));
      continue;
    }
    const station = NOAA_STATIONS[city];
    const observationStart = new Date(step.window.observationStart * 1_000).toISOString().slice(0, 10);
      const observationEnd = new Date(step.window.observationEnd * 1_000).toISOString().slice(0, 10);
      const request = {
        city,
        stationId: station.stationId,
        observationStart,
        observationEnd,
        thresholdMm: 1,
        operator: "gte" as const,
        protectedAmount: 1n,
      };
      try {
        const totals = await engine.analogueTotals(request);
        const thresholdMm = strikeFromAnalogueTotals(totals);
        if (thresholdMm == null) {
          priced.push(unpriced(step, station.stationId, "NOAA analogue history did not produce a positive strike."));
          continue;
        }
        const historic = historicHitBps(totals, thresholdMm);
        if (historic == null) {
          priced.push(unpriced(step, station.stationId, "NOAA analogue history could not be scored."));
          continue;
        }
        const price = priceFromHistory(historic);
        const inputsHash = canonicalSourceHash({
          schema: "skyhedge-noaa-quote-inputs-v1",
          city,
          stationId: station.stationId,
          observationStart,
          observationEndExclusive: observationEnd,
          thresholdMm,
          operator: "gte",
          analogueTotalsMm: totals,
          forecastCumulativeMm: null,
          strike: "8th-of-10-analogue-years",
          pricing: { ...price, historicProbabilityBps: historic, forecastProbabilityBps: null },
        });
        priced.push({
          ...step,
          thresholdMm,
          probabilityBps: price.probabilityBps,
          premiumRateBps: price.premiumRateBps,
          forecastIncluded: false,
          inputsHash,
          stationId: station.stationId,
          skipReason: null,
        });
      } catch (error) {
        priced.push(unpriced(step, station.stationId, error instanceof Error ? error.message : "NOAA pricing failed."));
      }
  }
  return priced;
}

export function evidenceHashes(stationId: string, peril: PerilId = "rain"): { stationIdHash: string; providerHash: string; methodologyHash: string } {
  const hashes = methodologyHashes(peril === "cold" ? "rain" : peril);
  return {
    stationIdHash: canonicalSourceHash(stationId),
    providerHash: hashes.providerHash,
    methodologyHash: hashes.methodologyHash,
  };
}

export function cityHashBytes(slug: string, peril: PerilId = "rain"): Buffer {
  return createHash("sha256").update(perilCityHashInput(slug, peril)).digest();
}

/** On-chain i64. Rain whole millimetres stay threshold × 100. Tenths use scaledX100. */
export function encodeStrike(step: { thresholdMm: number | null; scaledX100?: number }): bigint {
  if (step.scaledX100 != null) return BigInt(step.scaledX100);
  return BigInt(step.thresholdMm ?? 0) * 100n;
}

function unpriced(step: LadderStep, stationId: string, skipReason: string): PricedLadderStep {
  return { ...step, thresholdMm: null, probabilityBps: null, premiumRateBps: null, forecastIncluded: false, inputsHash: null, stationId, skipReason };
}
