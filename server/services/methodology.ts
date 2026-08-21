import * as fs from "node:fs";
import * as path from "node:path";

export interface Methodology {
  version: string;
  updatedAt: string;
  consensus: { finalSource: string; verificationSource: string; agreementToleranceMm: number; agreementTolerancePct: number; rule: string; disagreementAction: string };
  observation: { metric: string; units: string; window: string };
  cities: Record<string, { noaaStation: string; wxmDiscovery: { radiusKm: number; minQod: number; maxStations: number; aggregation: string } }>;
}

let cached: Methodology | null = null;

/** Committed settlement methodology (shared/methodology-v1.json), cached after first read. */
export function loadMethodology(): Methodology {
  if (!cached) {
    const file = path.resolve(process.cwd(), "shared/methodology-v1.json");
    cached = JSON.parse(fs.readFileSync(file, "utf8")) as Methodology;
  }
  return cached;
}