import { expect } from "chai";
import { readFileSync } from "node:fs";

describe("vercel rewrites", () => {
  it("maps the legacy claim-readiness path (used by installed APKs) to the mobile endpoint before the SPA fallback", () => {
    const config = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
    const index = config.rewrites.findIndex((r: { source: string }) => r.source === "/api/markets/:market/positions/:wallet/claim-readiness");
    const spa = config.rewrites.findIndex((r: { source: string }) => r.source === "/(.*)");
    expect(index).to.be.greaterThan(-1);
    expect(index).to.be.lessThan(spa);
    expect(config.rewrites[index].destination).to.equal("/api/mobile?resource=claim-readiness&market=:market&wallet=:wallet");
  });
});
