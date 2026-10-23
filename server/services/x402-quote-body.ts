import { z } from "zod";
import { multipleLabel } from "../../shared/pay-get.js";
import { chanceLabel, committedWindowLabel } from "../../shared/window-chain.js";
import { tenorOf } from "../../shared/window-ladder.js";
import { NOAA_STATIONS, type SkyHedgeCity } from "./noaa.js";
import { MARKET_LIMITS, type Quote, type TriggerOperator } from "./quote-engine.js";
import { DEVNET_USDC_MINT } from "./x402-facilitator.js";
import type { ApiRequest } from "./vercel-api.js";

const OPERATOR_SIGN = { gt: ">", gte: "≥", lt: "<", lte: "≤" } as const;
const citySchema = z.enum(Object.keys(NOAA_STATIONS) as [SkyHedgeCity, ...SkyHedgeCity[]]);

export type QuoteQuery = {
  city: SkyHedgeCity;
  observationStart: string;
  observationEnd: string;
  thresholdMm: number;
  operator: TriggerOperator;
  protectedAmount: string;
};

export function parseQuoteQuery(req: ApiRequest): { ok: true; value: QuoteQuery } | { ok: false; status: number; error: string; message: string } {
  const cityRaw = queryValue(req, "city");
  if (!cityRaw) return { ok: false, status: 400, error: "INVALID_QUOTE_REQUEST", message: "Provide city, a weekly or monthly window, trigger, operator, and protectedAmount." };
  const city = citySchema.safeParse(cityRaw);
  if (!city.success) return { ok: false, status: 400, error: "UNKNOWN_CITY", message: "That city is not a SkyHedge NOAA rainfall market." };
  const observationStart = queryValue(req, "observationStart") ?? "";
  const observationEnd = queryValue(req, "observationEnd") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(observationStart) || !/^\d{4}-\d{2}-\d{2}$/.test(observationEnd)) {
    return { ok: false, status: 400, error: "INVALID_QUOTE_REQUEST", message: "Observation dates must be YYYY-MM-DD UTC dates." };
  }
  const start = Date.parse(`${observationStart}T00:00:00.000Z`) / 1_000;
  const end = Date.parse(`${observationEnd}T00:00:00.000Z`) / 1_000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || !tenorOf(start, end)) {
    return { ok: false, status: 400, error: "UNKNOWN_WINDOW", message: "The window must be a Monday-to-Monday week or a calendar month, in UTC." };
  }
  const operator = z.enum(["gt", "gte", "lt", "lte"]).safeParse(queryValue(req, "operator"));
  const threshold = z.coerce.number().finite().positive().safeParse(queryValue(req, "thresholdMm"));
  const amount = z.string().regex(/^\d+$/).safeParse(queryValue(req, "protectedAmount"));
  if (!operator.success || !threshold.success || !amount.success) {
    return { ok: false, status: 400, error: "INVALID_QUOTE_REQUEST", message: "Provide a positive threshold in millimetres, an operator, and a protected amount in SKYT base units." };
  }
  const protectedAmount = BigInt(amount.data);
  if (protectedAmount === 0n || protectedAmount > MARKET_LIMITS.perWallet) {
    return { ok: false, status: 400, error: "PROTECTION_LIMIT_EXCEEDED", message: "Protection must be greater than zero and no more than 500 SKYT." };
  }
  return { ok: true, value: { city: city.data, observationStart, observationEnd, thresholdMm: threshold.data, operator: operator.data, protectedAmount: amount.data } };
}

export function presentQuote(request: QuoteQuery, quote: Quote, pricing: "committed-market" | "live-noaa", transaction: string, payer?: string) {
  const station = NOAA_STATIONS[request.city];
  const start = Date.parse(`${request.observationStart}T00:00:00.000Z`) / 1_000;
  const end = Date.parse(`${request.observationEnd}T00:00:00.000Z`) / 1_000;
  const sign = OPERATOR_SIGN[request.operator];
  return {
    city: request.city,
    cityName: station.city,
    window: {
      observationStart: request.observationStart,
      observationEnd: request.observationEnd,
      tenor: tenorOf(start, end),
      label: committedWindowLabel({ observationStart: start, observationEnd: end }),
    },
    trigger: { thresholdMm: request.thresholdMm, operator: request.operator, label: `${sign} ${request.thresholdMm} mm` },
    premium: quote.premium.toString(),
    payout: request.protectedAmount,
    multiple: multipleLabel(BigInt(request.protectedAmount), quote.premium),
    probability: chanceLabel(quote.probabilityBps),
    probabilityBps: quote.probabilityBps,
    premiumRateBps: quote.premiumRateBps,
    fee: quote.protocolFee.toString(),
    protocolFee: quote.protocolFee.toString(),
    protectedAmount: request.protectedAmount,
    modelVersion: quote.modelVersion,
    inputsHash: quote.inputsHash,
    source: "NOAA" as const,
    evidence: {
      station: { id: station.stationId, name: station.city, state: station.state, latitude: station.latitude, longitude: station.longitude, dataset: station.dataset ?? "GHCND" },
      sources: ["NOAA GHCND daily precipitation", "NOAA quantitative precipitation forecast"],
      inputsHash: quote.inputsHash,
      modelVersion: quote.modelVersion,
      pricing,
    },
    payment: {
      network: "solana-devnet",
      scheme: "exact",
      asset: DEVNET_USDC_MINT,
      transaction,
      explorer: `https://explorer.solana.com/tx/${encodeURIComponent(transaction)}?cluster=devnet`,
      payer: payer ?? null,
    },
  };
}

function queryValue(req: ApiRequest, name: string): string | undefined {
  const value = req.query?.[name];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  try { return new URL(req.url ?? "", "http://localhost").searchParams.get(name) ?? undefined; } catch { return undefined; }
}
