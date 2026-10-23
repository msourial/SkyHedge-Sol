import { PublicKey } from "@solana/web3.js";
import { decodePaymentSignatureHeader, encodePaymentRequiredHeader, encodePaymentResponseHeader } from "@x402/core/http";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { x402Version } from "@x402/core";
import { applyCorsHeaders } from "./cors.js";
import { isAllowedWebOrigin } from "../../shared/public-origins.js";
import type { DevnetStatus } from "./devnet-status.js";
import { DataUnavailableError, NOAA_STATIONS, type SkyHedgeCity } from "./noaa.js";
import { quoteFromCommittedMarketTerms, type Quote, type TriggerOperator } from "./quote-engine.js";
import { matchingOpenWindow } from "./tester-readiness.js";
import { parseQuoteQuery, presentQuote, type QuoteQuery } from "./x402-quote-body.js";
import {
  DEFAULT_QUOTE_PRICE_USDC,
  DEVNET_USDC_MINT,
  FacilitatorUnavailableError,
  SOLANA_DEVNET_CAIP2,
  X402_FACILITATOR_URL,
  usdcToAtomic,
  type QuoteFacilitator,
} from "./x402-facilitator.js";
import type { ApiRequest, ApiResponse } from "./vercel-api.js";

const REPLAY_TTL_MS = 120_000;

export interface X402QuoteConfig {
  payTo: string;
  priceAtomic: string;
  priceUsdc: string;
  facilitatorUrl: string;
}

export function readX402QuoteConfig(env: NodeJS.ProcessEnv = process.env): { ok: true; value: X402QuoteConfig } | { ok: false; error: "DEVNET_ONLY" | "PAYMENT_NOT_CONFIGURED"; message: string } {
  if ((env.SOLANA_NETWORK ?? "devnet") !== "devnet") {
    return { ok: false, error: "DEVNET_ONLY", message: "x402 quotes run on Solana Devnet only." };
  }
  const payTo = env.X402_PAY_TO?.trim() ?? "";
  try {
    if (!payTo || new PublicKey(payTo).toBase58() !== payTo) throw new Error("bad address");
  } catch {
    return { ok: false, error: "PAYMENT_NOT_CONFIGURED", message: "Set X402_PAY_TO to the Devnet wallet that should receive USDC. No quote is returned until that public address is configured." };
  }
  const priceUsdc = env.X402_QUOTE_PRICE_USDC?.trim() || DEFAULT_QUOTE_PRICE_USDC;
  const priceAtomic = usdcToAtomic(priceUsdc);
  if (!priceAtomic) {
    return { ok: false, error: "PAYMENT_NOT_CONFIGURED", message: "X402_QUOTE_PRICE_USDC must be a positive USDC amount of at most 1, with up to 6 decimal places." };
  }
  const facilitatorUrl = env.X402_FACILITATOR_URL?.trim() || X402_FACILITATOR_URL;
  if (!/^https:\/\//.test(facilitatorUrl)) {
    return { ok: false, error: "PAYMENT_NOT_CONFIGURED", message: "X402_FACILITATOR_URL must be an https facilitator that settles Solana Devnet." };
  }
  return { ok: true, value: { payTo, priceAtomic, priceUsdc, facilitatorUrl } };
}

type QuoteArgs = { city: SkyHedgeCity; stationId: string; observationStart: string; observationEnd: string; thresholdMm: number; operator: TriggerOperator; protectedAmount: bigint };

export function createX402QuoteHandler(dependencies: {
  readStatus: () => Promise<DevnetStatus>;
  quote: (request: QuoteArgs) => Promise<Quote>;
  facilitator: QuoteFacilitator;
  config: X402QuoteConfig | null;
  now?: () => number;
}) {
  const seen = new Map<string, number>();
  const now = dependencies.now ?? Date.now;

  return async function x402Quote(req: ApiRequest, res: ApiResponse) {
    paymentCors(req, res);
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method && req.method !== "GET") return methodNotAllowed(res);
    if (!dependencies.config) {
      const problem = readX402QuoteConfig();
      const failure = problem.ok ? { error: "PAYMENT_NOT_CONFIGURED", message: "The receiving address is not configured." } : problem;
      return send(res, 503, { error: failure.error, message: failure.message });
    }
    const config = dependencies.config;
    const parsed = parseQuoteQuery(req);
    if (!parsed.ok) return send(res, parsed.status, { error: parsed.error, message: parsed.message });

    let requirements: PaymentRequirements;
    try {
      requirements = paymentRequirements(config, await dependencies.facilitator.feePayer());
    } catch (error) {
      if (error instanceof FacilitatorUnavailableError) return send(res, 503, { error: "FACILITATOR_UNAVAILABLE", message: error.message });
      return send(res, 503, { error: "FACILITATOR_UNAVAILABLE", message: "The Solana Devnet facilitator could not be reached." });
    }

    const header = headerValue(req, "payment-signature");
    if (!header) return paymentRequired(res, requirements, resourceUrl(req), "PAYMENT_REQUIRED", "Send the exact Devnet USDC amount in a PAYMENT-SIGNATURE header. The quote is withheld until that payment settles.");

    let payload: PaymentPayload;
    try {
      payload = decodePaymentSignatureHeader(header);
    } catch {
      return paymentRequired(res, requirements, resourceUrl(req), "PAYMENT_INVALID", "PAYMENT-SIGNATURE is not a valid x402 V2 payload. No quote was returned.");
    }
    const mismatch = payloadMismatch(payload, requirements);
    if (mismatch) return paymentRequired(res, requirements, resourceUrl(req), mismatch.error, mismatch.message);

    const transaction = typeof payload.payload.transaction === "string" ? payload.payload.transaction : "";
    if (!transaction) return paymentRequired(res, requirements, resourceUrl(req), "PAYMENT_INVALID", "The exact scheme on Solana needs a partially signed transaction. No quote was returned.");
    if (remember(seen, transaction, now())) return paymentRequired(res, requirements, resourceUrl(req), "PAYMENT_REPLAYED", "This payment was already used. Send a new one. No quote was returned.");

    let verify;
    try {
      verify = await dependencies.facilitator.verify(payload, requirements);
    } catch (error) {
      forget(seen, transaction);
      if (error instanceof FacilitatorUnavailableError) return send(res, 503, { error: "FACILITATOR_UNAVAILABLE", message: error.message });
      return send(res, 503, { error: "FACILITATOR_UNAVAILABLE", message: "The Solana Devnet facilitator could not verify the payment." });
    }
    if (!verify.isValid) {
      forget(seen, transaction);
      const failure = classify(verify.invalidReason);
      return paymentRequired(res, requirements, resourceUrl(req), failure.error, failure.message);
    }

    let priced;
    try {
      priced = await priceQuote(parsed.value, dependencies.readStatus, dependencies.quote);
    } catch (error) {
      forget(seen, transaction);
      if (error instanceof DataUnavailableError) return send(res, 503, { error: error.code, message: error.message });
      return send(res, 503, { error: "QUOTE_UNAVAILABLE", message: "The quote could not be prepared. The payment was not settled." });
    }

    let settled;
    try {
      settled = await dependencies.facilitator.settle(payload, requirements);
    } catch (error) {
      if (error instanceof FacilitatorUnavailableError) return send(res, 503, { error: "FACILITATOR_UNAVAILABLE", message: `${error.message} No quote was returned.` });
      return send(res, 503, { error: "FACILITATOR_UNAVAILABLE", message: "The facilitator could not settle the payment. No quote was returned." });
    }
    if (!settled.success || !settled.transaction) {
      const failure = classify(settled.errorReason);
      if (failure.error !== "PAYMENT_REPLAYED" && settled.errorReason !== "settlement_timeout") forget(seen, transaction);
      return paymentRequired(res, requirements, resourceUrl(req), failure.error, settled.errorMessage || failure.message);
    }

    const body = presentQuote(parsed.value, priced.quote, priced.pricing, settled.transaction, settled.payer);
    res.setHeader("PAYMENT-RESPONSE", encodePaymentResponseHeader({
      success: true,
      transaction: settled.transaction,
      network: SOLANA_DEVNET_CAIP2,
      payer: settled.payer,
    }));
    res.setHeader("Cache-Control", "no-store");
    return send(res, 200, body);
  };
}

function paymentRequirements(config: X402QuoteConfig, feePayer: string): PaymentRequirements {
  return {
    scheme: "exact",
    network: SOLANA_DEVNET_CAIP2,
    amount: config.priceAtomic,
    asset: DEVNET_USDC_MINT,
    payTo: config.payTo,
    maxTimeoutSeconds: 60,
    extra: { feePayer },
  };
}

function payloadMismatch(payload: PaymentPayload, requirements: PaymentRequirements): { error: string; message: string } | null {
  if (payload.x402Version !== x402Version) return { error: "PAYMENT_INVALID", message: "This endpoint speaks x402 V2. No quote was returned." };
  const accepted = payload.accepted;
  if (!accepted || accepted.scheme !== "exact") return { error: "WRONG_SCHEME", message: "This endpoint accepts the exact scheme only. No quote was returned." };
  if (accepted.network !== SOLANA_DEVNET_CAIP2) return { error: "WRONG_NETWORK", message: "Payment must be on Solana Devnet. Mainnet and other networks are refused. No quote was returned." };
  if (accepted.asset !== DEVNET_USDC_MINT) return { error: "WRONG_ASSET", message: "Payment must be Devnet USDC. No quote was returned." };
  if (!sameAmount(accepted.amount, requirements.amount)) return { error: "WRONG_AMOUNT", message: `Payment must be exactly ${requirements.amount} Devnet USDC base units. No quote was returned.` };
  if (accepted.payTo !== requirements.payTo) return { error: "PAYMENT_INVALID", message: "The payment recipient does not match this endpoint. No quote was returned." };
  return null;
}

function classify(reason: string | undefined): { error: string; message: string } {
  const text = reason ?? "";
  if (isReplay(text)) return { error: "PAYMENT_REPLAYED", message: "This payment was already used or did not settle as a new transfer. No quote was returned." };
  if (/amount|value_mismatch/i.test(text)) return { error: "WRONG_AMOUNT", message: "The paid amount does not match the advertised price. No quote was returned." };
  if (/network/i.test(text)) return { error: "WRONG_NETWORK", message: "The payment is not for Solana Devnet. No quote was returned." };
  if (/asset|mint/i.test(text)) return { error: "WRONG_ASSET", message: "The payment asset is not Devnet USDC. No quote was returned." };
  return { error: "PAYMENT_UNSETTLED", message: "The payment was not settled. No quote was returned." };
}

function isReplay(reason: string | undefined): boolean {
  return /replay|duplicate|already (?:been )?(?:used|settled|processed|confirmed)|transaction already/i.test(reason ?? "");
}

async function priceQuote(request: QuoteQuery, readStatus: () => Promise<DevnetStatus>, quote: (request: QuoteArgs) => Promise<Quote>): Promise<{ quote: Quote; pricing: "committed-market" | "live-noaa" }> {
  const amount = BigInt(request.protectedAmount);
  const status = await readStatus();
  const matched = matchingOpenWindow(status, request.observationStart, request.observationEnd, request.thresholdMm, request.operator, Math.floor(Date.now() / 1_000), request.city);
  if (matched?.quoteProbabilityBps != null && matched.premiumRateBps != null && matched.quoteInputsHash) {
    return {
      pricing: "committed-market",
      quote: quoteFromCommittedMarketTerms({ protectedAmount: amount, probabilityBps: matched.quoteProbabilityBps, premiumRateBps: matched.premiumRateBps, inputsHash: matched.quoteInputsHash }),
    };
  }
  return {
    pricing: "live-noaa",
    quote: await quote({ ...request, stationId: NOAA_STATIONS[request.city].stationId, protectedAmount: amount }),
  };
}

function paymentRequired(res: ApiResponse, requirements: PaymentRequirements, url: string, error: string, message: string) {
  const paymentRequiredBody = {
    x402Version,
    error: message,
    resource: { url, description: "One SkyHedge rainfall quote", mimeType: "application/json", serviceName: "SkyHedge" },
    accepts: [requirements],
  };
  res.setHeader("PAYMENT-REQUIRED", encodePaymentRequiredHeader(paymentRequiredBody));
  res.setHeader("Cache-Control", "no-store");
  return send(res, 402, { error, message, paymentRequired: paymentRequiredBody });
}

function remember(seen: Map<string, number>, transaction: string, at: number): boolean {
  for (const [key, expires] of seen) if (expires <= at) seen.delete(key);
  const existing = seen.get(transaction);
  if (existing && existing > at) return true;
  seen.set(transaction, at + REPLAY_TTL_MS);
  return false;
}

function forget(seen: Map<string, number>, transaction: string) {
  seen.delete(transaction);
}

function sameAmount(left: string, right: string): boolean {
  try { return BigInt(left) === BigInt(right); } catch { return false; }
}

function resourceUrl(req: ApiRequest): string {
  const path = req.url ?? "/api/x402/quote";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const host = (headerValue(req, "x-forwarded-host") ?? headerValue(req, "host") ?? "skyhedge.app").split(",")[0]?.trim();
  const local = host?.startsWith("127.0.0.1") || host?.startsWith("localhost") || host?.startsWith("[::1]");
  const proto = (headerValue(req, "x-forwarded-proto") ?? (local ? "http" : "https")).split(",")[0]?.trim() || "https";
  return `${proto}://${host}${path.startsWith("/") ? path : `/${path}`}`;
}

function headerValue(req: ApiRequest, name: string): string | undefined {
  const raw = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
}

function paymentCors(req: ApiRequest, res: ApiResponse) {
  applyCorsHeaders(req, res);
  const origin = headerValue(req, "origin");
  if (!isAllowedWebOrigin(origin)) return;
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, PAYMENT-SIGNATURE");
  res.setHeader("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE");
}

function methodNotAllowed(res: ApiResponse) {
  res.setHeader("Allow", "GET");
  return send(res, 405, { error: "METHOD_NOT_ALLOWED", message: "Use GET." });
}

function send(res: ApiResponse, status: number, body: unknown) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(body);
}
