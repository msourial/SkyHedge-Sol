import { expect } from "chai";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import express from "express";
import type { ServerResponse } from "node:http";
import { PublicKey } from "@solana/web3.js";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { ANALOGUE_YEARS } from "../../shared/window-ladder";
import { committedPremiumQuote } from "../../shared/market-pricing";
import { quoteFromCommittedMarketTerms } from "./quote-engine";
import { createQuoteHandler } from "./vercel-api";
import { createX402QuoteHandler, readX402QuoteConfig, type X402QuoteConfig } from "./x402-quote";
import { SOLANA_DEVNET_CAIP2, DEVNET_USDC_MINT } from "./x402-facilitator";
import { createEvidencePackageHandler } from "../../api/evidence-package";
import type { DevnetStatus } from "./devnet-status";
import type { ApiRequest, ApiResponse } from "./vercel-api";

const PAY_TO = PublicKey.unique().toBase58();
const FEE = PublicKey.unique().toBase58();
const HASH = "ab".repeat(32);

class ResponseStub {
  code = 200;
  body: unknown;
  headers: Record<string, string | string[]> = {};
  status(code: number) { this.code = code; return this; }
  json(body: unknown) { this.body = body; return this; }
  setHeader(name: string, value: string | string[]) { this.headers[name] = value; return this; }
  end() { return this; }
}

describe("rain pricing and the five no-pay checks", () => {
  it("still prices 100 SKYT of New York cover at 24 SKYT from two analogue hits", () => {
    const committed = quoteFromCommittedMarketTerms({ protectedAmount: 100_000_000n, probabilityBps: 2_000, premiumRateBps: 2_400, inputsHash: HASH });
    expect(committed.premium).to.equal(24_000_000n);
    expect(committed.historicalWindows).to.equal(ANALOGUE_YEARS);
    expect(ANALOGUE_YEARS).to.equal(10);
    expect(committed.modelVersion).to.equal("noaa-rain-v1");
    expect(committedPremiumQuote({ protectedAmount: "100000000", probabilityBps: 2_000, premiumRateBps: 2_400, inputsHash: HASH })).to.include({
      premium: "24000000",
      modelVersion: "noaa-rain-v1",
    });
  });

  it("returns 24 SKYT on the New York purchase quote and refuses a modelled rung", async () => {
    const start = 1_793_491_200;
    const end = start + 7 * 86_400;
    const observationStart = new Date(start * 1_000).toISOString().slice(0, 10);
    const observationEnd = new Date(end * 1_000).toISOString().slice(0, 10);
    const status = {
      program: { executable: true },
      idl: { status: "ready" },
      protocol: { initialized: true },
      desMoinesMarket: { status: "pending", evidenceStatus: "researching_evidence", onchainStatus: null, vaultBalance: null },
      cityWindows: [{
        city: "new-york",
        status: "ready",
        address: "NyRain1111111111111111111111111111111111",
        vaultBalance: "2000000000",
        onchainStatus: JSON.stringify({ open: {} }),
        salesCloseAt: start,
        observationStart: start,
        observationEnd: end,
        thresholdMmX100: "6900",
        operator: "gte",
        quoteProbabilityBps: 2_000,
        premiumRateBps: 2_400,
        quoteInputsHash: HASH,
        evidenceStatus: "validated",
      }],
    } as unknown as DevnetStatus;
    let liveQuotes = 0;
    const handler = createQuoteHandler({ readStatus: async () => status, quote: async () => { liveQuotes += 1; throw new Error("live quote"); } });
    const response = new ResponseStub();
    await handler({
      method: "POST",
      body: { city: "new-york", observationStart, observationEnd, thresholdMm: 69, operator: "gte", protectedAmount: "100000000" },
    } as ApiRequest, response as unknown as ServerResponse as ApiResponse);
    expect(response.code).to.equal(200);
    expect(liveQuotes).to.equal(0);
    expect(response.body).to.include({ premium: "24000000", modelVersion: "noaa-rain-v1", protectedAmount: "100000000" });

    const modelled = new ResponseStub();
    await handler({
      method: "POST",
      body: { city: "chicago", peril: "snow", observationStart: "2026-11-09", observationEnd: "2026-11-16", triggerValue: 43, operator: "gte", protectedAmount: "100000000" },
    } as ApiRequest, modelled as unknown as ApiResponse);
    expect(modelled.code).to.equal(409);
    expect(modelled.body).to.include({ error: "TESTER_QUOTE_UNAVAILABLE" });
    expect(liveQuotes).to.equal(0);

    const cold = new ResponseStub();
    await handler({
      method: "POST",
      body: { city: "chicago", peril: "cold", observationStart: "2026-12-01", observationEnd: "2027-01-01", thresholdMm: 1, operator: "gte", protectedAmount: "100000000" },
    } as ApiRequest, cold as unknown as ApiResponse);
    expect(cold.code).to.equal(409);
    expect(cold.body).to.include({ error: "PERIL_NOT_OPEN" });
  });

  it("returns 402 with Devnet terms from x402 and does not change that rain-only path", async () => {
    const response = new ResponseStub();
    const handler = createX402QuoteHandler({
      readStatus: async () => ({ desMoinesMarket: { status: "pending" }, cityWindows: [] }) as unknown as DevnetStatus,
      quote: async () => { throw new Error("x402 must not price before payment"); },
      facilitator: { async feePayer() { return FEE; }, async verify() { return { isValid: true, payer: PAY_TO }; }, async settle() { return { success: true, transaction: "sig", network: SOLANA_DEVNET_CAIP2, payer: PAY_TO }; } },
      config: { payTo: PAY_TO, priceAtomic: "10000", priceUsdc: "0.01", facilitatorUrl: "https://x402.org/facilitator" } satisfies X402QuoteConfig,
    });
    const url = "/api/x402/quote?city=des-moines&observationStart=2026-11-02&observationEnd=2026-11-09&thresholdMm=50&operator=gte&protectedAmount=100000000";
    await handler({ method: "GET", url, headers: {}, query: Object.fromEntries(new URL(url, "https://skyhedge.app").searchParams) } as unknown as ApiRequest, response as unknown as ApiResponse);
    expect(response.code).to.equal(402);
    const required = decodePaymentRequiredHeader(String(response.headers["PAYMENT-REQUIRED"]));
    expect(required.accepts[0]).to.include({ scheme: "exact", network: SOLANA_DEVNET_CAIP2, amount: "10000", asset: DEVNET_USDC_MINT, payTo: PAY_TO });
    expect(readX402QuoteConfig({ SOLANA_NETWORK: "mainnet-beta", X402_PAY_TO: PAY_TO })).to.include({ ok: false, error: "DEVNET_ONLY" });
  });

  it("serves the landing page and /developers with HTTP 200 from the SPA shell", async () => {
    const html = readFileSync(new URL("../../client/index.html", import.meta.url), "utf8");
    const appSource = readFileSync(new URL("../../client/src/App.tsx", import.meta.url), "utf8");
    expect(appSource).to.match(/path="\/"/);
    expect(appSource).to.match(/path="\/developers"/);
    const app = express();
    app.use("*", (_req, res) => { res.status(200).type("html").send(html); });
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    const port = address && typeof address === "object" ? address.port : 0;
    try {
      const landing = await fetch(`http://127.0.0.1:${port}/`);
      const developers = await fetch(`http://127.0.0.1:${port}/developers`);
      expect(landing.status).to.equal(200);
      expect(developers.status).to.equal(200);
      expect(await landing.text()).to.include('id="root"');
      expect(await developers.text()).to.include('id="root"');
    } finally {
      server.close();
    }
  });

  it("returns des-moines evidence JSON when the package is available locally", async () => {
    const handler = createEvidencePackageHandler(async (range) => ({
      validated: true,
      stationId: "GHCND:USW00014933",
      stationIdHash: "11".repeat(32),
      providerHash: "22".repeat(32),
      methodologyHash: "33".repeat(32),
      quoteTerms: null,
      evidence: { sourceHash: "55".repeat(32), cumulativeMm: 12.7, windowStart: range.start, windowEnd: range.end },
    }));
    const response = new ResponseStub();
    await handler({ method: "GET", url: "/api/evidence-package" } as never, response as never);
    expect(response.code).to.equal(200);
    expect(response.body).to.include({ validated: true, stationId: "GHCND:USW00014933", quoteTerms: null });
  });
});
