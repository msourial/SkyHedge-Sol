import type { AdvisoryResponse } from "./api.ts";

export function guideActionLabel(result: AdvisoryResponse | null): string | null {
  if (!result?.match) return null;
  if (result.status === "quote_ready") return "Review matching contract";
  if (result.status === "matched") return "View research status";
  return null;
}

export function guideEvidenceLabel(result: AdvisoryResponse | null): string {
  if (!result?.match) return "No contract selected";
  return result.match.evidenceStatus === "validated" ? "NOAA evidence committed" : "Researching NOAA evidence";
}
