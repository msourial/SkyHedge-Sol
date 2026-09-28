import { expect } from "chai";
import { settlementWorkerReadiness } from "./settlement-config";

describe("settlement worker health readiness", () => {
  it("reports configured only when signer, NOAA, and cron authentication are ready", () => {
    expect(settlementWorkerReadiness({ signerConfigured: true, noaaConfigured: true, cronSecret: "a-secure-cron-secret" })).to.deep.eq({
      status: "configured",
      scheduler: "vercel-cron",
      signerConfigured: true,
      noaaConfigured: true,
      cronAuthConfigured: true,
    });
  });

  it("does not call the worker configured when cron authentication is absent or too short", () => {
    expect(settlementWorkerReadiness({ signerConfigured: true, noaaConfigured: true }).status).to.equal("manual-or-missing");
    expect(settlementWorkerReadiness({ signerConfigured: true, noaaConfigured: true, cronSecret: "short" }).status).to.equal("manual-or-missing");
  });

  it("keeps missing signer or NOAA credentials visible as unconfigured", () => {
    expect(settlementWorkerReadiness({ signerConfigured: false, noaaConfigured: true, cronSecret: "a-secure-cron-secret" }).status).to.equal("manual-or-missing");
    expect(settlementWorkerReadiness({ signerConfigured: true, noaaConfigured: false, cronSecret: "a-secure-cron-secret" }).status).to.equal("manual-or-missing");
  });
});
