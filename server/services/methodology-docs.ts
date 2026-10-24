import { canonicalSourceHash } from "./noaa.js";
import rainMethodology from "../../shared/methodology-v1.json" with { type: "json" };
import snowMethodology from "../../shared/methodology-snow-v1.json" with { type: "json" };
import windMethodology from "../../shared/methodology-wind-v1.json" with { type: "json" };
import heatMethodology from "../../shared/methodology-heat-v1.json" with { type: "json" };
import { PERILS, type PerilId } from "../../shared/perils.js";

const DOCUMENTS = {
  rain: rainMethodology,
  snow: snowMethodology,
  wind: windMethodology,
  heat: heatMethodology,
} as const;

export type OpenPerilId = keyof typeof DOCUMENTS;

export function methodologyDocument(peril: OpenPerilId): (typeof DOCUMENTS)[OpenPerilId] {
  return DOCUMENTS[peril];
}

export function methodologyHashes(peril: OpenPerilId): { providerHash: string; methodologyHash: string } {
  const document = DOCUMENTS[peril];
  return {
    providerHash: canonicalSourceHash(document),
    methodologyHash: canonicalSourceHash(document.version),
  };
}

/** Rain documents stay the committed methodology-v1 object, so existing hashes do not move. */
export function perilForPinnedHashes(
  stationId: string,
  stationHash: string,
  providerHash: string,
  methodologyHash: string,
): OpenPerilId | null {
  if (stationHash !== canonicalSourceHash(stationId)) return null;
  for (const peril of Object.keys(DOCUMENTS) as OpenPerilId[]) {
    const hashes = methodologyHashes(peril);
    if (providerHash === hashes.providerHash && methodologyHash === hashes.methodologyHash) return peril;
  }
  return null;
}

export function modelVersionFor(peril: PerilId): NonNullable<(typeof PERILS)[PerilId]["modelVersion"]> | null {
  return PERILS[peril].modelVersion;
}
