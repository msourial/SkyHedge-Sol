import { expect } from "chai";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createAdvisoryHandler } from "./advisory-api";
import type { DevnetStatus } from "./devnet-status";

class ResponseStub {
  code = 200;
  body: unknown;
  headers: Record<string, string> = {};
  status(code: number) { this.code = code; return this; }
  json(body: unknown) { this.body = body; return this; }
  setHeader(key: string, value: string) { this.headers[key] = value; return this; }
}

const request = (body: unknown) => ({ method: "POST", body } as IncomingMessage & { body: unknown });

describe("advisory API", () => {
  it("rejects invalid input before any model or chain call", async () => {
    let calls = 0;
    const handler = createAdvisoryHandler({ extract: async () => { calls++; throw new Error("should not run"); }, readStatus: async () => { calls++; throw new Error("should not run"); } });
    const res = new ResponseStub();
    await handler(request({ message: "x" }), res as unknown as ServerResponse);
    expect(res.code).to.equal(400);
    expect(calls).to.equal(0);
  });

  it("returns a research-only Toronto match with no quote or unsigned transaction", async () => {
    const handler = createAdvisoryHandler({
      extract: async () => ({ place: "Toronto", useCase: "event", hazard: "rainfall", direction: "above", date: "2026-10-22", amount: "100", amountUnit: "USD", requestedThresholdMm: 1 }),
      readStatus: async () => ({ desMoinesMarket: {} }) as DevnetStatus,
    });
    const res = new ResponseStub();
    await handler(request({ message: "Toronto event, 2026-10-22, rain over 1 mm, $100" }), res as unknown as ServerResponse);
    expect(res.code).to.equal(200);
    expect(res.body).to.include({ status: "matched", quote: null, transaction: null, explicitApprovalRequired: true });
    expect(res.headers["Cache-Control"]).to.equal("no-store");
  });

  it("keeps research explanations available during RPC failure but never marks a quote ready", async () => {
    const handler = createAdvisoryHandler({
      extract: async () => ({ place: "Toronto", useCase: "event", hazard: "rainfall", direction: "above", date: "2026-10-22", amount: "100", amountUnit: "USD", requestedThresholdMm: 1 }),
      readStatus: async () => { throw new Error("RPC offline"); },
    });
    const res = new ResponseStub();
    await handler(request({ message: "Toronto event on 2026-10-22 for $100, worried about rain" }), res as unknown as ServerResponse);
    expect(res.code).to.equal(200);
    expect(res.body).to.include({ status: "matched", quote: null, transaction: null });
  });
});
