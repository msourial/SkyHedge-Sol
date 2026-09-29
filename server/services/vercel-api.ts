import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { DataUnavailableError, NOAA_STATIONS, type SkyHedgeCity } from "./noaa.js";
import { MARKET_LIMITS, quoteFromCommittedMarketTerms, type Quote, type TriggerOperator } from "./quote-engine.js";
import { desMoinesQuoteUnavailableReason, testerProtectionUnavailableReason } from "./tester-readiness.js";
import type { DevnetStatus } from "./devnet-status";
import { ClaimUnavailableError, type ClaimReadiness, type TxAction, type UnsignedTransactionBuilder, type UnsignedTxResult } from "./unsigned-tx.js";

export type ApiRequest = IncomingMessage & { body?: unknown; query?: Record<string, string | string[] | undefined> };
export type ApiResponse = ServerResponse & { status: (code: number) => ApiResponse; json: (body: unknown) => unknown };

const citySchema = z.enum(Object.keys(NOAA_STATIONS) as [SkyHedgeCity, ...SkyHedgeCity[]]);
const quoteSchema = z.object({
  city: citySchema,
  observationStart: z.string().date(),
  observationEnd: z.string().date(),
  thresholdMm: z.number().finite().positive(),
  operator: z.enum(["gt", "gte", "lt", "lte"]),
  protectedAmount: z.string().regex(/^\d+$/),
}).refine(({ observationStart, observationEnd }) => observationStart < observationEnd, "Observation start must precede end");

function publicKeySchema() {
  return z.string().min(32).max(44).refine((value) => {
    try { return new PublicKey(value).toBase58() === value; } catch { return false; }
  }, "Must be a canonical Solana public key");
}

const unsignedIntentSchema = z.object({
  action: z.enum(["fund_pool", "withdraw_liquidity", "open_position", "claim_payout", "claim_premium_refund", "redeem_closed_liquidity"]),
  market: publicKeySchema(),
  wallet: publicKeySchema(),
  amount: z.string().regex(/^\d+$/).optional(),
  approved: z.literal(true),
});

function sendJson(res: ApiResponse, status: number, body: unknown) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(body);
}

function methodNotAllowed(res: ApiResponse, allowed: string) {
  res.setHeader("Allow", allowed);
  return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED", message: `Use ${allowed}.` });
}

export function createQuoteHandler(dependencies: {
  readStatus: () => Promise<DevnetStatus>;
  quote: (request: { city: SkyHedgeCity; stationId: string; observationStart: string; observationEnd: string; thresholdMm: number; operator: TriggerOperator; protectedAmount: bigint }) => Promise<Quote>;
}) {
  return async function quoteHandler(req: ApiRequest, res: ApiResponse) {
    if (req.method && req.method !== "POST") return methodNotAllowed(res, "POST");
    const parsed = quoteSchema.safeParse(req.body);
    if (!parsed.success) return sendJson(res, 400, { error: "INVALID_PROTECTION_PARAMETERS", message: "Provide valid rainfall protection parameters." });
    const request = parsed.data;
    const amount = BigInt(request.protectedAmount);
    if (amount === 0n || amount > MARKET_LIMITS.perWallet) {
      return sendJson(res, 400, { error: "PROTECTION_LIMIT_EXCEEDED", message: "Protection must be greater than zero and no more than 500 SKYT." });
    }

    try {
      let finalizedStatus: DevnetStatus | null = null;
      if (request.city === "des-moines") {
        finalizedStatus = await dependencies.readStatus();
        const reason = desMoinesQuoteUnavailableReason(finalizedStatus, request.observationStart, request.observationEnd, request.thresholdMm, request.operator);
        if (reason) return sendJson(res, 409, { error: "TESTER_QUOTE_UNAVAILABLE", message: reason });
      }
      const quote = request.city === "des-moines" && finalizedStatus
        ? quoteFromCommittedMarketTerms({
          protectedAmount: amount,
          probabilityBps: finalizedStatus.desMoinesMarket.quoteProbabilityBps!,
          premiumRateBps: finalizedStatus.desMoinesMarket.premiumRateBps!,
          inputsHash: finalizedStatus.desMoinesMarket.quoteInputsHash!,
        })
        : await dependencies.quote({
          ...request,
          stationId: NOAA_STATIONS[request.city].stationId,
          protectedAmount: amount,
          operator: request.operator as TriggerOperator,
        });
      res.setHeader("Cache-Control", "no-store");
      return sendJson(res, 200, {
        ...quote,
        premium: quote.premium.toString(),
        protocolFee: quote.protocolFee.toString(),
        protectedAmount: request.protectedAmount,
        source: "NOAA",
        explicitApprovalRequired: true,
      });
    } catch (error) {
      if (error instanceof DataUnavailableError) return sendJson(res, 503, { error: error.code, message: error.message });
      return sendJson(res, 500, { error: "QUOTE_UNAVAILABLE", message: "The quote could not be prepared." });
    }
  };
}

export function createUnsignedTransactionHandler(dependencies: {
  readStatus: () => Promise<DevnetStatus>;
  builder: Pick<UnsignedTransactionBuilder, "build">;
}) {
  return async function unsignedTransactionHandler(req: ApiRequest, res: ApiResponse) {
    if (req.method && req.method !== "POST") return methodNotAllowed(res, "POST");
    const parsed = unsignedIntentSchema.safeParse(req.body);
    if (!parsed.success) return sendJson(res, 400, { error: "INVALID_TRANSACTION_INTENT", message: "A valid market, wallet, action, and explicit approval are required." });
    const intent = parsed.data;
    try {
      if (intent.action === "open_position") {
        const reason = testerProtectionUnavailableReason(await dependencies.readStatus(), intent.market, intent.amount ?? "");
        if (reason) return sendJson(res, 409, { error: "TESTER_ACTION_UNAVAILABLE", message: reason });
      }
      const transaction = await dependencies.builder.build(intent.action as TxAction, intent.market, intent.wallet, intent.amount);
      res.setHeader("Cache-Control", "no-store");
      return sendJson(res, 200, {
        ...transaction,
        note: "Serialized with zero signatures; your wallet must review and sign before broadcast. No simulation or transaction submission occurs here.",
      });
    } catch (error) {
      if (error instanceof ClaimUnavailableError) return sendJson(res, 409, { error: "CLAIM_UNAVAILABLE", message: error.message });
      return sendJson(res, 500, { error: "TX_BUILD_ERROR", message: "The unsigned transaction could not be prepared from finalized Devnet state." });
    }
  };
}

export function createClaimReadinessHandler(dependencies: {
  read: (market: string, wallet: string) => Promise<ClaimReadiness>;
}) {
  return async function claimReadinessHandler(req: ApiRequest, res: ApiResponse) {
    if (req.method && req.method !== "GET") return methodNotAllowed(res, "GET");
    const market = queryValue(req.query?.market);
    const wallet = queryValue(req.query?.wallet);
    const parsed = z.object({ market: publicKeySchema(), wallet: publicKeySchema() }).safeParse({ market, wallet });
    if (!parsed.success) return sendJson(res, 400, { error: "INVALID_CLAIM_QUERY", message: "A valid market and wallet address are required." });
    try {
      res.setHeader("Cache-Control", "no-store");
      return sendJson(res, 200, await dependencies.read(parsed.data.market, parsed.data.wallet));
    } catch {
      return sendJson(res, 503, { error: "CLAIM_STATUS_UNAVAILABLE", message: "Finalized claim status could not be read." });
    }
  };
}

function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export type { UnsignedTxResult };
