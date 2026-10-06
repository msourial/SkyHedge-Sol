import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AdvisoryResponse } from "./api.ts";
import { guideActionLabel, guideEvidenceLabel } from "./guide.ts";

const result: AdvisoryResponse = {
  status: "matched", message: "Research only", intent: { place: "Toronto", useCase: "event", hazard: "rainfall", direction: "above", date: "2026-10-22", amount: "100", amountUnit: "USD", requestedThresholdMm: 1 },
  match: { slug: "toronto", location: "Toronto, Ontario, Canada", useCase: "event", evidenceStatus: "researching_evidence", marketAddress: null },
  unavailableReason: "No validated evidence", costExplanation: "No premium", payoutExplanation: "No payout", quote: null, transaction: null, explicitApprovalRequired: true,
};

describe("guide presentation", () => {
  it("labels research as research rather than a purchase", () => {
    assert.equal(guideActionLabel(result), "View research status");
    assert.equal(guideEvidenceLabel(result), "Researching NOAA evidence");
  });
  it("shows contract review only for an authoritative quote-ready response", () => {
    assert.equal(guideActionLabel({ ...result, status: "quote_ready", match: { ...result.match!, evidenceStatus: "validated" } }), "Review matching contract");
    assert.equal(guideActionLabel({ ...result, status: "no_match", match: null }), null);
  });
});
