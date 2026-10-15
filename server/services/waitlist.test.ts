import { expect } from "chai";
import { honeypotAckId, normalizeWaitlistEmail, validateWaitlistBody } from "./waitlist";

describe("waitlist validation", () => {
  it("normalizes email case and whitespace", () => {
    expect(normalizeWaitlistEmail("  Alex@SkyHedge.APP ")).to.equal("alex@skyhedge.app");
  });

  it("accepts a valid email and empty honeypot", () => {
    const result = validateWaitlistBody({ email: "tester@example.com", company: "" });
    expect(result.ok).to.equal(true);
    if (!result.ok) return;
    expect(result.emailNormalized).to.equal("tester@example.com");
    expect(result.honeypot).to.equal(false);
  });

  it("flags honeypot fills without rejecting the request shape", () => {
    const result = validateWaitlistBody({ email: "bot@example.com", company: "Acme Spam" });
    expect(result.ok).to.equal(true);
    if (!result.ok) return;
    expect(result.honeypot).to.equal(true);
    expect(honeypotAckId(result.emailNormalized)).to.have.length(32);
  });

  it("rejects invalid emails", () => {
    const result = validateWaitlistBody({ email: "not-an-email" });
    expect(result.ok).to.equal(false);
    if (result.ok) return;
    expect(result.error).to.equal("INVALID_EMAIL");
  });
});
