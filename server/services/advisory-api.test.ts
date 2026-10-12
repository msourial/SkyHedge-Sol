import { expect } from "chai";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createAdvisoryHandler } from "./advisory-api";
import { AdvisoryNotConfiguredError, AdvisoryUnavailableError } from "./advisory";
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

  describe("offline guide (no model key)", () => {
    const offline = () => createAdvisoryHandler({ extract: async () => { throw new AdvisoryNotConfiguredError("The AI guide is not configured."); }, readStatus: async () => { throw new Error("unused"); } });
    const ask = async (message: string) => { const res = new ResponseStub(); await offline()(request({ message }), res as unknown as ServerResponse); return res; };

    it("answers instead of surfacing the configuration error, labelled offline, with no quote or transaction", async () => {
      const res = await ask("How does a payout work?");
      expect(res.code).to.equal(200);
      const body = res.body as Record<string, unknown>;
      expect(body).to.include({ mode: "offline", modeLabel: "Guide answers (offline mode)", quote: null, transaction: null, match: null, explicitApprovalRequired: true });
      expect(String(body.message)).to.match(/50, 100 or 250 SKYT/);
      expect(String(body.message)).to.not.match(/not configured/i);
    });

    it("is honest that Saskatoon is not live and points to Des Moines", async () => {
      const message = String(((await ask("I farm near Saskatoon and worry about too little rain")).body as { message: string }).message);
      expect(message).to.match(/Saskatoon isn't live yet/);
      expect(message).to.match(/Des Moines/);
    });

    it("explains the 1% fee without inventing a price, and Toronto as Opens soon", async () => {
      const fee = String(((await ask("What does coverage cost?")).body as { message: string }).message);
      expect(fee).to.match(/1% SkyHedge fee/);
      expect(fee).to.not.match(/\d+(\.\d+)?\s*SKYT premium|\$\d/);
      expect(String(((await ask("Toronto wedding rain")).body as { message: string }).message)).to.match(/Opens soon/);
    });

    it("greets with a welcome for unmatched questions", async () => {
      expect(String(((await ask("hello there")).body as { message: string }).message)).to.match(/I can explain how SkyHedge/);
    });

    it("falls back to offline answers on provider outages too", async () => {
      const handler = createAdvisoryHandler({ extract: async () => { throw new AdvisoryUnavailableError("down"); }, readStatus: async () => ({}) as DevnetStatus });
      const res = new ResponseStub();
      await handler(request({ message: "payout question" }), res as unknown as ServerResponse);
      expect(res.code).to.equal(200);
      expect(res.body).to.include({ mode: "offline", quote: null, transaction: null });
    });
  });
});
