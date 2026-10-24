import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { DataUnavailableError, NOAA_STATIONS, type SkyHedgeCity } from "./noaa.js";
import { MARKET_LIMITS, quoteFromCommittedMarketTerms, type Quote, type QuoteModelVersion, type TriggerOperator } from "./quote-engine.js";
import { desMoinesQuoteUnavailableReason, matchingOpenWindow, testerProtectionUnavailableReason } from "./tester-readiness.js";
import { PERILS, isPerilId, perilOpenForCity, type PerilId } from "../../shared/perils.js";
import type { WindowQuote } from "../../shared/ui-quote-types.js";
import { prepareFailure } from "../../shared/prepare-failure.js";
import { isRpcRateLimited } from "./rpc-failover.js";
import type { DevnetStatus } from "./devnet-status";
import { ClaimUnavailableError, type ClaimReadiness, type TxAction, type UnsignedTransactionBuilder, type UnsignedTxResult } from "./unsigned-tx.js";
import { applyCorsHeaders } from "./cors.js";

export type ApiRequest = IncomingMessage & { body?: unknown; query?: Record<string, string | string[] | undefined> };
export type ApiResponse = ServerResponse & { status: (code: number) => ApiResponse; json: (body: unknown) => unknown };

const citySchema = z.enum(Object.keys(NOAA_STATIONS) as [SkyHedgeCity, ...SkyHedgeCity[]]);
const quoteSchema = z.object({
  city: citySchema,
  observationStart: z.string().date(),
  observationEnd: z.string().date(),
  thresholdMm: z.number().finite().positive().optional(),
  triggerValue: z.number().finite().positive().optional(),
  peril: z.enum(["rain", "snow", "wind", "heat", "cold"]).optional(),
  operator: z.enum(["gt", "gte", "lt", "lte"]),
  protectedAmount: z.string().regex(/^\d+$/),
}).refine(({ observationStart, observationEnd }) => observationStart < observationEnd, "Observation start must precede end")
  .refine((value) => value.thresholdMm != null || value.triggerValue != null, "A trigger is required");

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
  readWindowQuote?: (query: { peril: string; cityId: string; windowStart: string; windowEnd: string }) => Promise<WindowQuote>;
}) {
  return async function quoteHandler(req: ApiRequest, res: ApiResponse) {
    applyCorsHeaders(req, res);
    if (req.method === "GET") return windowQuoteResponse(req, res, dependencies.readWindowQuote);
    if (req.method && req.method !== "POST") return methodNotAllowed(res, "GET, POST");
    const parsed = quoteSchema.safeParse(req.body);
    if (!parsed.success) {
      const named = req.body && typeof req.body === "object" && "peril" in req.body ? (req.body as { peril?: unknown }).peril : undefined;
      const message = named && named !== "rain"
        ? "Provide a valid city, window, trigger, and amount."
        : "Provide valid rainfall protection parameters.";
      return sendJson(res, 400, { error: "INVALID_PROTECTION_PARAMETERS", message });
    }
    const request = parsed.data;
    const peril: PerilId = request.peril ?? "rain";
    const trigger = request.thresholdMm ?? request.triggerValue;
    if (trigger == null || (request.thresholdMm != null && request.triggerValue != null && request.thresholdMm !== request.triggerValue)) {
      return sendJson(res, 400, { error: "INVALID_PROTECTION_PARAMETERS", message: peril === "rain" ? "Provide valid rainfall protection parameters." : "Provide a valid city, window, trigger, and amount." });
    }
    const amount = BigInt(request.protectedAmount);
    if (amount === 0n || amount > MARKET_LIMITS.perWallet) {
      return sendJson(res, 400, { error: "PROTECTION_LIMIT_EXCEEDED", message: "Protection must be greater than zero and no more than 500 SKYT." });
    }
    if (!PERILS[peril].open) return sendJson(res, 409, { error: "PERIL_NOT_OPEN", message: PERILS[peril].closedReason ?? "This peril is not open." });
    if (!perilOpenForCity(peril, request.city)) return sendJson(res, 409, { error: "PERIL_NOT_AVAILABLE", message: `${PERILS[peril].label} is not open for this city.` });

    try {
      const finalizedStatus = await dependencies.readStatus();
      const now = Math.floor(Date.now() / 1_000);
      if (peril === "rain" && request.city === "des-moines") {
        const reason = desMoinesQuoteUnavailableReason(finalizedStatus, request.observationStart, request.observationEnd, trigger, request.operator);
        if (reason) return sendJson(res, 409, { error: "TESTER_QUOTE_UNAVAILABLE", message: reason });
      } else if (!matchingOpenWindow(finalizedStatus, request.observationStart, request.observationEnd, trigger, request.operator, now, request.city, peril)) {
        return sendJson(res, 409, { error: "TESTER_QUOTE_UNAVAILABLE", message: peril === "rain" ? "That city's open window does not match this quote." : "That trigger is not an open market." });
      }
      const matched = matchingOpenWindow(finalizedStatus, request.observationStart, request.observationEnd, trigger, request.operator, now, request.city, peril);
      const modelVersion = PERILS[peril].modelVersion ?? "noaa-rain-v1";
      const quote = matched
        ? quoteFromCommittedMarketTerms({
          protectedAmount: amount,
          probabilityBps: matched.quoteProbabilityBps!,
          premiumRateBps: matched.premiumRateBps!,
          inputsHash: matched.quoteInputsHash!,
          ...(peril === "rain" ? {} : { modelVersion: modelVersion as QuoteModelVersion }),
        })
        : await dependencies.quote({
          city: request.city,
          stationId: NOAA_STATIONS[request.city].stationId,
          observationStart: request.observationStart,
          observationEnd: request.observationEnd,
          thresholdMm: trigger,
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
    applyCorsHeaders(req, res);
    if (req.method && req.method !== "POST") return methodNotAllowed(res, "POST");
    const parsed = unsignedIntentSchema.safeParse(req.body);
    if (!parsed.success) return sendJson(res, 400, { error: "INVALID_TRANSACTION_INTENT", message: "A valid market, wallet, action, and explicit approval are required." });
    const intent = parsed.data;
    try {
      if (intent.action === "open_position") {
        try {
          const reason = testerProtectionUnavailableReason(await dependencies.readStatus(), intent.market, intent.amount ?? "");
          if (reason) return sendJson(res, 409, { error: "TESTER_ACTION_UNAVAILABLE", message: reason, detail: reason });
        } catch (error) {
          if (!isRpcRateLimited(error)) throw error;
          console.error("[unsigned] status read rate-limited; the program still checks the window", error);
        }
      }
      const transaction = await dependencies.builder.build(intent.action as TxAction, intent.market, intent.wallet, intent.amount);
      res.setHeader("Cache-Control", "no-store");
      return sendJson(res, 200, {
        ...transaction,
        note: "Serialized with zero signatures; your wallet must review and sign before broadcast. No simulation or transaction submission occurs here.",
      });
    } catch (error) {
      console.error("[unsigned] prepare failed", error);
      if (error instanceof ClaimUnavailableError) return sendJson(res, 409, { error: "CLAIM_UNAVAILABLE", message: error.message, detail: error.message });
      const failure = prepareFailure(error);
      return sendJson(res, 503, { error: "TX_BUILD_ERROR", message: failure.message, detail: failure.detail });
    }
  };
}

export function createClaimReadinessHandler(dependencies: {
  read: (market: string, wallet: string) => Promise<ClaimReadiness>;
}) {
  return async function claimReadinessHandler(req: ApiRequest, res: ApiResponse) {
    applyCorsHeaders(req, res);
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

async function windowQuoteResponse(
  req: ApiRequest,
  res: ApiResponse,
  readWindowQuote: ((query: { peril: string; cityId: string; windowStart: string; windowEnd: string }) => Promise<WindowQuote>) | undefined,
) {
  if (!readWindowQuote) return sendJson(res, 503, { error: "WINDOW_QUOTE_UNAVAILABLE", message: "Window quotes are not configured." });
  const peril = queryValue(req.query?.peril) ?? "rain";
  const cityId = queryValue(req.query?.city) ?? queryValue(req.query?.cityId);
  const windowStart = queryValue(req.query?.observationStart) ?? queryValue(req.query?.windowStart);
  const windowEnd = queryValue(req.query?.observationEnd) ?? queryValue(req.query?.windowEnd);
  if (!cityId || !windowStart || !windowEnd || !isPerilId(peril)) {
    return sendJson(res, 400, { error: "INVALID_WINDOW_QUOTE", message: "city, peril, observationStart, and observationEnd are required." });
  }
  try {
    res.setHeader("Cache-Control", "no-store");
    return sendJson(res, 200, await readWindowQuote({ peril, cityId, windowStart, windowEnd }));
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    const message = error instanceof Error ? error.message : "The window quote could not be prepared.";
    if (code === "PERIL_NOT_OPEN" || code === "PERIL_NOT_AVAILABLE") return sendJson(res, 409, { error: code, message });
    if (code === "DATA_UNAVAILABLE") return sendJson(res, 503, { error: code, message });
    return sendJson(res, 400, { error: "INVALID_WINDOW_QUOTE", message });
  }
}

export type { UnsignedTxResult };
