import methodologyData from "../../shared/methodology-v1.json";

export interface Methodology {
  version: string;
  updatedAt: string;
  settlement: { finalSource: string; rule: string; unavailableAction: string };
  observation: { metric: string; units: string; window: string };
  cities: Record<string, { noaaStation: string }>;
}

/** Committed settlement methodology (shared/methodology-v1.json), bundled into serverless builds. */
export function loadMethodology(): Methodology {
  return methodologyData as Methodology;
}
