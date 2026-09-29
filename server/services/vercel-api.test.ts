import { expect } from "chai";
import type { IncomingMessage, ServerResponse } from "node:http";
import { PublicKey } from "@solana/web3.js";
import type { DevnetStatus } from "./devnet-status";
import { createClaimReadinessHandler, createQuoteHandler, createUnsignedTransactionHandler } from "./vercel-api";

const MARKET = PublicKey.unique().toBase58();
const WALLET = PublicKey.unique().toBase58();

class ResponseStub {
  code = 200;
  body: unknown;
  headers: Record<string, string> = {};
  status(code: number) { this.code = code; return this; }
  json(body: unknown) { this.body = body; return this; }
  setHeader(name: string, value: string) { this.headers[name] = value; return this; }
}

const status = {
  program: { executable: true },
  idl: { status: "ready", supportsEmptyDraftCancellation: false },
  protocol: { initialized: true },
  desMoinesMarket: {
    status: "ready", address: MARKET,
    vaultBalance: "2000000000", onchainStatus: JSON.stringify({ open: {} }),
    salesCloseAt: 2_000_000_000, observationStart: 2_000_086_400,
    observationEnd: 2_000_691_200, thresholdMmX100: "5000", operator: "gte",
    quoteProbabilityBps: 2_000, premiumRateBps: 2_400, quoteInputsHash: "b".repeat(64),
    evidenceStatus: "validated",
  },
  noaaEvidence: { status: "ready" },
} as unknown as DevnetStatus;

function request(method: string, body?: unknown, query?: Record<string, string>) {
  return { method, body, query, url: "/api/test" } as unknown as IncomingMessage & { body?: unknown; query?: Record<string, string> };
}

describe("Vercel production API routes", () => {
  it("serves a validated quote only after the same finalized Des Moines readiness gates", async () => {
    let quoteCalls = 0;
    let currentStatus = { ...status, desMoinesMarket: { ...status.desMoinesMarket, status: "pending" } } as DevnetStatus;
    const observationStart = new Date(Number(status.desMoinesMarket.observationStart) * 1_000).toISOString().slice(0, 10);
    const observationEnd = new Date(Number(status.desMoinesMarket.observationEnd) * 1_000).toISOString().slice(0, 10);
    const body = { city: "des-moines", observationStart, observationEnd, thresholdMm: 50, operator: "gte", protectedAmount: "1000000" };
    const handler = createQuoteHandler({ readStatus: async () => currentStatus, quote: async () => {
      quoteCalls++;
      return { probabilityBps: 2_000, premiumRateBps: 2_400, premium: 24_000_000n, protocolFee: 1_000_000n, inputsHash: "a".repeat(64), modelVersion: "noaa-rain-v1", historicalWindows: 10, forecastWeight: 0.3 };
    } });

    const denied = new ResponseStub();
    await handler(request("POST", body), denied as unknown as ServerResponse);
    expect(denied.code).to.equal(409);
    expect(quoteCalls).to.equal(0);

    currentStatus = status;
    const allowed = new ResponseStub();
    await handler(request("POST", body), allowed as unknown as ServerResponse);
    expect(allowed.code).to.equal(200);
    expect(quoteCalls).to.equal(0);
    expect(allowed.body).to.include({ probabilityBps: 2_000, premiumRateBps: 2_400, premium: "240000", protocolFee: "10000", inputsHash: "b".repeat(64), explicitApprovalRequired: true });
  });

  it("refuses unsigned protection transactions unless approval and finalized market prerequisites are present", async () => {
    let buildCalls = 0;
    const handler = createUnsignedTransactionHandler({
      readStatus: async () => status,
      builder: { build: async () => { buildCalls++; return { action: "open_position", market: MARKET, wallet: WALLET, base64: "AA==", description: "Buy protection", programId: "program", network: "devnet" }; } } as never,
    });
    const missingApproval = new ResponseStub();
    await handler(request("POST", { action: "open_position", market: MARKET, wallet: WALLET, amount: "1000000" }), missingApproval as unknown as ServerResponse);
    expect(missingApproval.code).to.equal(400);
    expect(buildCalls).to.equal(0);

    const approved = new ResponseStub();
    await handler(request("POST", { action: "open_position", market: MARKET, wallet: WALLET, amount: "1000000", approved: true }), approved as unknown as ServerResponse);
    expect(approved.code).to.equal(200);
    expect(buildCalls).to.equal(1);
  });

  it("exposes finalized claim readiness from the production route", async () => {
    const handler = createClaimReadinessHandler({ read: async (market, wallet) => ({ market, wallet, state: "claimable", action: "claim_payout", result: "triggered", amount: "100000000", claimDeadline: 2_000_000_000, finalizedSlot: 88, reason: "Finalized settlement confirms payout.", observationSignature: "observation-sig", resolutionSignature: "settlement-sig", observation: null }) });
    const response = new ResponseStub();
    await handler(request("GET", undefined, { market: MARKET, wallet: WALLET }), response as unknown as ServerResponse);
    expect(response.code).to.equal(200);
    expect(response.body).to.include({ state: "claimable", action: "claim_payout", finalizedSlot: 88 });
  });
});
