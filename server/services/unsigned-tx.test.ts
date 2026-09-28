import { expect } from "chai";
import { evaluateClaimReadiness, hasInstructionLog } from "./unsigned-tx";

describe("finalized oracle claim readiness", () => {
  const base = { marketStatus: "settled", result: "triggered", claimDeadline: 2_000, chainNow: 1_000, payoutClaimed: false, refundClaimed: false };

  it("allows a payout only for a finalized triggered settlement before the claim deadline", () => {
    expect(evaluateClaimReadiness(base)).to.deep.eq({
      state: "claimable",
      action: "claim_payout",
      reason: "Finalized on-chain settlement confirms this position can claim its fixed payout.",
    });
  });

  it("does not allow claims while oracle settlement is pending or for a losing result", () => {
    expect(evaluateClaimReadiness({ ...base, marketStatus: "awaitingSettlement" }).state).to.eq("pending");
    expect(evaluateClaimReadiness({ ...base, result: "notTriggered" }).state).to.eq("not_claimable");
  });

  it("allows a premium refund only for finalized DATA_UNAVAILABLE state", () => {
    const refund = evaluateClaimReadiness({ ...base, marketStatus: "dataUnavailable", result: "dataUnavailable" });
    expect(refund.state).to.eq("claimable");
    expect(refund.action).to.eq("claim_premium_refund");
  });

  it("rejects already claimed or expired positions", () => {
    expect(evaluateClaimReadiness({ ...base, payoutClaimed: true }).state).to.eq("claimed");
    expect(evaluateClaimReadiness({ ...base, chainNow: 2_001 }).state).to.eq("expired");
  });

  it("recognizes Anchor instruction logs in snake_case and camel case", () => {
    expect(hasInstructionLog(["Program log: Instruction: settle_market"], "SettleMarket")).to.equal(true);
    expect(hasInstructionLog(["Program log: Instruction: MarkDataUnavailable"], "mark_data_unavailable")).to.equal(true);
    expect(hasInstructionLog(["Program log: Instruction: ClaimPayout"], "SettleMarket")).to.equal(false);
  });
});
