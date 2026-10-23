import { expect } from "chai";
import { readFileSync } from "node:fs";
import type { ServerResponse } from "node:http";
import { PublicKey } from "@solana/web3.js";
import { decodePaymentRequiredHeader, encodePaymentSignatureHeader } from "@x402/core/http";
import type { DevnetStatus } from "./devnet-status";
import { FacilitatorUnavailableError, SOLANA_DEVNET_CAIP2, DEVNET_USDC_MINT, usdcToAtomic } from "./x402-facilitator";
import { createX402QuoteHandler, readX402QuoteConfig, type X402QuoteConfig } from "./x402-quote";
import type { ApiRequest, ApiResponse } from "./vercel-api";
import type { QuoteFacilitator } from "./x402-facilitator";

const PAY_TO = PublicKey.unique().toBase58();
const FEE = PublicKey.unique().toBase58();
const PAYER = PublicKey.unique().toBase58();
const TX = "cGF5bWVudC10eA==";
const QUERY = "/api/x402/quote?city=des-moines&observationStart=2026-11-02&observationEnd=2026-11-09&thresholdMm=50&operator=gte&protectedAmount=100000000";
const CONFIG: X402QuoteConfig = { payTo: PAY_TO, priceAtomic: "10000", priceUsdc: "0.01", facilitatorUrl: "https://x402.org/facilitator" };
const LIVE_QUOTE = { probabilityBps: 2_000, premiumRateBps: 2_400, premium: 24_000_000n, protocolFee: 1_000_000n, inputsHash: "a".repeat(64), modelVersion: "noaa-rain-v1" as const, historicalWindows: 10, forecastWeight: 0.3 };

class ResponseStub {
  code = 200;
  body: unknown;
  headers: Record<string, string | string[]> = {};
  status(code: number) { this.code = code; return this; }
  json(body: unknown) { this.body = body; return this; }
  setHeader(name: string, value: string | string[]) { this.headers[name] = value; return this; }
  end() { return this; }
}

function request(url = QUERY, headers: Record<string, string> = {}) {
  return { method: "GET", url, headers, query: Object.fromEntries(new URL(url, "https://skyhedge.app").searchParams) } as ApiRequest;
}

function signature(transaction = TX, accepted: Record<string, unknown> = {}) {
  return encodePaymentSignatureHeader({
    x402Version: 2,
    accepted: { scheme: "exact", network: SOLANA_DEVNET_CAIP2, amount: "10000", asset: DEVNET_USDC_MINT, payTo: PAY_TO, maxTimeoutSeconds: 60, extra: { feePayer: FEE }, ...accepted },
    payload: { transaction },
  });
}

function facilitator(partial: Partial<QuoteFacilitator> = {}): { calls: string[]; client: QuoteFacilitator } {
  const calls: string[] = [];
  return {
    calls,
    client: {
      async feePayer() { calls.push("feePayer"); return FEE; },
      async verify() { calls.push("verify"); return { isValid: true, payer: PAYER }; },
      async settle() { calls.push("settle"); return { success: true, transaction: "sig", network: SOLANA_DEVNET_CAIP2, payer: PAYER }; },
      ...partial,
    },
  };
}

const closedStatus = { desMoinesMarket: { status: "pending", evidenceStatus: "researching_evidence", onchainStatus: null, vaultBalance: null }, cityWindows: [] } as unknown as DevnetStatus;

function handler(options: { quote?: () => Promise<typeof LIVE_QUOTE>; status?: DevnetStatus; client?: QuoteFacilitator; config?: X402QuoteConfig | null } = {}) {
  return createX402QuoteHandler({
    readStatus: async () => options.status ?? closedStatus,
    quote: options.quote ?? (async () => LIVE_QUOTE),
    facilitator: options.client ?? facilitator().client,
    config: options.config === undefined ? CONFIG : options.config,
  });
}

describe("x402 quote", () => {
  it("prices 0.01 USDC as 10000 base units and stays on Devnet", () => {
    expect(usdcToAtomic("0.01")).to.equal("10000");
    expect(readX402QuoteConfig({ SOLANA_NETWORK: "mainnet-beta", X402_PAY_TO: PAY_TO })).to.include({ ok: false, error: "DEVNET_ONLY" });
    expect(readX402QuoteConfig({ SOLANA_NETWORK: "devnet" })).to.include({ ok: false, error: "PAYMENT_NOT_CONFIGURED" });
    expect(readX402QuoteConfig({ X402_PAY_TO: PAY_TO, X402_QUOTE_PRICE_USDC: "0.01" })).to.deep.include({ ok: true });
  });

  it("returns a 402 with exact Devnet USDC requirements and no quote", async () => {
    let quotes = 0;
    const gate = facilitator();
    const response = new ResponseStub();
    await handler({ client: gate.client, quote: async () => { quotes += 1; return LIVE_QUOTE; } })(request(), response as unknown as ServerResponse as ApiResponse);
    expect(response.code).to.equal(402);
    expect(quotes).to.equal(0);
    expect(gate.calls).to.deep.equal(["feePayer"]);
    const required = decodePaymentRequiredHeader(String(response.headers["PAYMENT-REQUIRED"]));
    expect(required.x402Version).to.equal(2);
    expect(required.accepts[0]).to.include({ scheme: "exact", network: SOLANA_DEVNET_CAIP2, amount: "10000", asset: DEVNET_USDC_MINT, payTo: PAY_TO });
    expect(required.accepts[0]?.extra).to.include({ feePayer: FEE });
    expect(JSON.stringify(response.body)).to.not.match(/"premium"/);
  });

  it("refuses an unknown city or window before asking the facilitator", async () => {
    const gate = facilitator();
    const city = new ResponseStub();
    await handler({ client: gate.client })(request(QUERY.replace("des-moines", "toronto")), city as unknown as ApiResponse);
    expect(city.code).to.equal(400);
    expect(city.body).to.include({ error: "UNKNOWN_CITY" });
    const window = new ResponseStub();
    await handler({ client: gate.client })(request(QUERY.replace("2026-11-02", "2026-11-03")), window as unknown as ApiResponse);
    expect(window.code).to.equal(400);
    expect(window.body).to.include({ error: "UNKNOWN_WINDOW" });
    expect(gate.calls).to.deep.equal([]);
  });

  it("settles a valid payment and returns the live pricing path", async () => {
    const calls: string[] = [];
    const gate = facilitator({
      verify: async () => { calls.push("verify"); return { isValid: true, payer: PAYER }; },
      settle: async () => { calls.push("settle"); return { success: true, transaction: "sig", network: SOLANA_DEVNET_CAIP2, payer: PAYER }; },
    });
    const response = new ResponseStub();
    await handler({
      client: gate.client,
      quote: async () => { calls.push("quote"); return LIVE_QUOTE; },
    })(request(QUERY, { "payment-signature": signature() }), response as unknown as ApiResponse);
    expect(response.code).to.equal(200);
    expect(calls).to.deep.equal(["verify", "quote", "settle"]);
    expect(response.body).to.include({
      city: "des-moines", premium: "24000000", payout: "100000000", multiple: "4.1×", probability: "20.0%", fee: "1000000", inputsHash: "a".repeat(64),
    });
    expect((response.body as { evidence: { station: { id: string }; sources: string[]; pricing: string } }).evidence).to.include({ pricing: "live-noaa" });
    expect((response.body as { evidence: { station: { id: string } } }).evidence.station.id).to.equal("GHCND:USW00014933");
    expect((response.body as { payment: { explorer: string } }).payment.explorer).to.equal("https://explorer.solana.com/tx/sig?cluster=devnet");
    expect(response.headers["PAYMENT-RESPONSE"]).to.be.a("string");
  });

  it("uses committed market terms when the open window matches", async () => {
    let quotes = 0;
    const start = Date.parse("2026-11-02T00:00:00.000Z") / 1000;
    const end = Date.parse("2026-11-09T00:00:00.000Z") / 1000;
    const status = {
      desMoinesMarket: {
        status: "ready", address: PublicKey.unique().toBase58(), vaultBalance: "2000000000",
        onchainStatus: JSON.stringify({ open: {} }), salesCloseAt: 2_000_000_000, observationStart: start, observationEnd: end,
        thresholdMmX100: "5000", operator: "gte", quoteProbabilityBps: 2_000, premiumRateBps: 2_400, quoteInputsHash: "b".repeat(64), evidenceStatus: "validated",
      },
      cityWindows: [],
    } as unknown as DevnetStatus;
    const response = new ResponseStub();
    await handler({ status, quote: async () => { quotes += 1; return LIVE_QUOTE; } })(request(QUERY, { "payment-signature": signature("b3RoZXI=") }), response as unknown as ApiResponse);
    expect(response.code).to.equal(200);
    expect(quotes).to.equal(0);
    expect(response.body).to.include({ premium: "24000000", protocolFee: "1000000", inputsHash: "b".repeat(64) });
    expect((response.body as { evidence: { pricing: string } }).evidence.pricing).to.equal("committed-market");
  });

  it("rejects the wrong amount, network, or asset without a quote", async () => {
    for (const [accepted, error] of [
      [{ amount: "1" }, "WRONG_AMOUNT"],
      [{ network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" }, "WRONG_NETWORK"],
      [{ asset: PublicKey.unique().toBase58() }, "WRONG_ASSET"],
    ] as const) {
      const gate = facilitator();
      const response = new ResponseStub();
      await handler({ client: gate.client, quote: async () => { throw new Error("priced"); } })(request(QUERY, { "payment-signature": signature(TX, accepted) }), response as unknown as ApiResponse);
      expect(response.code).to.equal(402);
      expect(response.body).to.include({ error });
      expect(gate.calls).to.deep.equal(["feePayer"]);
      expect(JSON.stringify(response.body)).to.not.match(/"premium"/);
    }
  });

  it("rejects a replayed or unsettled payment and a down facilitator", async () => {
    const replay = facilitator({ verify: async () => ({ isValid: false, invalidReason: "duplicate_settlement" }) });
    const replayed = new ResponseStub();
    await handler({ client: replay.client })(request(QUERY, { "payment-signature": signature("cmVwbGF5") }), replayed as unknown as ApiResponse);
    expect(replayed.body).to.include({ error: "PAYMENT_REPLAYED" });

    const unsettledGate = facilitator({ settle: async () => ({ success: false, errorReason: "insufficient_funds", transaction: "" }) });
    const unsettled = new ResponseStub();
    await handler({ client: unsettledGate.client })(request(QUERY, { "payment-signature": signature("dW5zZXR0bGVk") }), unsettled as unknown as ApiResponse);
    expect(unsettled.body).to.include({ error: "PAYMENT_UNSETTLED" });
    expect(JSON.stringify(unsettled.body)).to.not.match(/"premium"/);

    const down = facilitator({ feePayer: async () => { throw new FacilitatorUnavailableError("facilitator down"); } });
    const offline = new ResponseStub();
    await handler({ client: down.client })(request(), offline as unknown as ApiResponse);
    expect(offline.code).to.equal(503);
    expect(offline.body).to.include({ error: "FACILITATOR_UNAVAILABLE" });
  });

  it("does not quote again for a payment it already settled", async () => {
    let settlements = 0;
    const gate = facilitator({ settle: async () => { settlements += 1; return { success: true, transaction: "sig", network: SOLANA_DEVNET_CAIP2 }; } });
    const paid = handler({ client: gate.client });
    const first = new ResponseStub();
    const second = new ResponseStub();
    await paid(request(QUERY, { "payment-signature": signature("c2FtZQ==") }), first as unknown as ApiResponse);
    await paid(request(QUERY, { "payment-signature": signature("c2FtZQ==") }), second as unknown as ApiResponse);
    expect(first.code).to.equal(200);
    expect(second.code).to.equal(402);
    expect(second.body).to.include({ error: "PAYMENT_REPLAYED" });
    expect(settlements).to.equal(1);
  });

  it("does not describe the product as insurance", () => {
    const sources = ["x402-quote.ts", "x402-quote-body.ts", "x402-facilitator.ts"].map((file) => readFileSync(new URL(`./${file}`, import.meta.url), "utf8"));
    sources.push(readFileSync(new URL("../../client/src/pages/developers.tsx", import.meta.url), "utf8"));
    sources.push(readFileSync(new URL("../../docs/demo-script-x402.md", import.meta.url), "utf8"));
    sources.push(readFileSync(new URL("../../scripts/x402-agent-demo.ts", import.meta.url), "utf8"));
    expect(sources.join("\n")).to.not.match(/insurance/i);
  });
});
