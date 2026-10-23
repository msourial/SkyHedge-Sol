import { expect } from "chai";
import { isAmbiguousSettlement, nextPaymentAction, observeDevnetSignature, parseSignatureStatus } from "./x402-settlement";

describe("x402 settlement confirmation", () => {
  it("treats a 429 or a pending settlement as ambiguous and a rejected transfer as final", () => {
    expect(isAmbiguousSettlement("settlement_pending", "HTTP 429 Too Many Requests")).to.equal(true);
    expect(isAmbiguousSettlement("invalid_exact_svm_transaction_failed", "429 Too Many Requests")).to.equal(true);
    expect(isAmbiguousSettlement("settlement_timeout")).to.equal(true);
    expect(isAmbiguousSettlement("insufficient_funds")).to.equal(false);
    expect(isAmbiguousSettlement("duplicate_settlement")).to.equal(false);
  });

  it("reads confirmed, failed, submitted, and absent signature statuses", () => {
    expect(parseSignatureStatus({ result: { value: [{ err: null, confirmationStatus: "finalized" }] } })).to.equal("confirmed");
    expect(parseSignatureStatus({ result: { value: [{ err: { InstructionError: [0, "Custom"] }, confirmationStatus: "confirmed" }] } })).to.equal("failed");
    expect(parseSignatureStatus({ result: { value: [{ err: null, confirmationStatus: "processed" }] } })).to.equal("submitted");
    expect(parseSignatureStatus({ result: { value: [null] } })).to.equal("absent");
    expect(parseSignatureStatus({ error: { code: 429 } })).to.equal("unknown");
  });

  it("reuses a payment unless the chain shows it failed or expired", () => {
    expect(nextPaymentAction({ hasAttempt: false, ageMs: 0, view: null })).to.equal("pay");
    expect(nextPaymentAction({ hasAttempt: true, ageMs: 1_000, view: "confirmed" })).to.equal("reuse");
    expect(nextPaymentAction({ hasAttempt: true, ageMs: 1_000, view: "unknown" })).to.equal("reuse");
    expect(nextPaymentAction({ hasAttempt: true, ageMs: 1_000, view: "submitted" })).to.equal("reuse");
    expect(nextPaymentAction({ hasAttempt: true, ageMs: 1_000, view: "absent" })).to.equal("reuse");
    expect(nextPaymentAction({ hasAttempt: true, ageMs: 120_000, view: "absent" })).to.equal("pay");
    expect(nextPaymentAction({ hasAttempt: true, ageMs: 1_000, view: "failed" })).to.equal("pay");
    expect(nextPaymentAction({ hasAttempt: true, ageMs: 120_000, view: null })).to.equal("pay");
  });

  it("keeps looking after a 429 and stops on the first finalized status", async () => {
    const calls: string[] = [];
    const view = await observeDevnetSignature("1".repeat(88), {
      urls: ["https://rpc.example/a", "https://rpc.example/b"],
      sleep: async () => {},
      now: () => 0,
      deadlineMs: 10_000,
      fetch: async (url) => {
        calls.push(String(url));
        if (String(url).endsWith("/a")) return new Response("no", { status: 429 });
        return Response.json({ result: { value: [{ err: null, confirmationStatus: "confirmed" }] } });
      },
    });
    expect(view).to.equal("confirmed");
    expect(calls).to.deep.equal(["https://rpc.example/a", "https://rpc.example/b"]);
  });

  it("reports unknown when every RPC refuses, without calling it absent", async () => {
    const view = await observeDevnetSignature("1".repeat(88), {
      urls: ["https://rpc.example/a"],
      sleep: async () => {},
      now: () => 0,
      deadlineMs: 1,
      fetch: async () => new Response("no", { status: 429 }),
    });
    expect(view).to.equal("unknown");
  });
});
