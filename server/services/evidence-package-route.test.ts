import { expect } from "chai";
import express from "express";
import { createEvidencePackageHandler } from "../../api/evidence-package";
import { registerRoutes } from "../routes";

describe("local evidence package route", () => {
  it("exposes the same flat endpoint as the deployed API", async () => {
    const app = express();
    await registerRoutes(app);

    // Invoke the registered Express route directly so this contract test does
    // not need a TCP listener (which is unavailable in sandboxed CI runners).
    const routeLayer = (app as any)._router.stack.find((layer: any) => layer.route?.path === "/api/evidence-package");
    expect(routeLayer, "flat evidence route should be registered").to.exist;
    const handler = routeLayer.route.stack[0].handle;
    let status = 0;
    let body: unknown;
    const response = { status(code: number) { status = code; return this; }, json(value: unknown) { body = value; return this; } };
    await handler({ query: { start: "not-a-date", end: "also-not-a-date" } }, response);

    expect(status).to.equal(400);
    expect(body).to.deep.equal({ error: "VALID_DATE_WINDOW_REQUIRED" });

    status = 0;
    body = undefined;
    await handler({ query: { start: "2099-01-01", end: "2099-01-08" } }, response);
    expect(status).to.equal(400);
    expect(body).to.deep.equal({ error: "VALID_DATE_WINDOW_REQUIRED", message: "Only the server-selected, completed NOAA evidence window is permitted." });
  });
});

describe("deployed evidence package route", () => {
  it("accepts the Builder's no-date request and returns a completed NOAA window", async () => {
    let capturedRange: { start: string; end: string } | undefined;
    let status = 0;
    let body: unknown;
    const handler = createEvidencePackageHandler(async (range) => {
      capturedRange = range;
      return {
        validated: true,
        stationId: "GHCND:USW00014933",
        stationIdHash: "11".repeat(32),
        providerHash: "22".repeat(32),
        methodologyHash: "33".repeat(32),
        quoteTerms: null,
        evidence: { sourceHash: "55".repeat(32), cumulativeMm: 25.4, windowStart: range.start, windowEnd: range.end },
      };
    });
    const response = { status(code: number) { status = code; return this; }, json(value: unknown) { body = value; } };

    await handler({ method: "GET", url: "/api/evidence-package" } as never, response as never);

    expect(status).to.equal(200);
    expect(capturedRange).to.have.all.keys("start", "end");
    expect((body as { validated?: boolean }).validated).to.equal(true);
    expect((body as { quoteTerms?: unknown }).quoteTerms).to.equal(null);
    const start = Date.parse(`${capturedRange!.start}T00:00:00Z`);
    const end = Date.parse(`${capturedRange!.end}T00:00:00Z`);
    expect(end - start).to.equal(7 * 86_400_000);
    expect(end).to.be.at.most(Date.now() - 7 * 86_400_000);
  });

  it("rejects a partial or malformed date window without querying NOAA", async () => {
    let status = 0;
    let called = false;
    const handler = createEvidencePackageHandler(async () => { called = true; throw new Error("unexpected NOAA call"); });
    const response = { status(code: number) { status = code; return this; }, json() {} };

    await handler({ method: "GET", url: "/api/evidence-package?start=not-a-date" } as never, response as never);

    expect(status).to.equal(400);
    expect(called).to.equal(false);
  });

  it("rejects caller-selected past or future windows before fetching NOAA", async () => {
    let status = 0;
    let called = false;
    const handler = createEvidencePackageHandler(async () => { called = true; throw new Error("NOAA should not be queried"); });
    const response = { status(code: number) { status = code; return this; }, json() {} };

    await handler({ method: "GET", url: "/api/evidence-package?start=2099-01-01&end=2099-01-08" } as never, response as never);

    expect(status).to.equal(400);
    expect(called).to.equal(false);
  });
});
