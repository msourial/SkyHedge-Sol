import { canonicalSourceHash, cumulativeMillimeters, DataUnavailableError, NOAA_STATIONS, type DailyRainfall, type RainfallProvider, type SkyHedgeCity } from "./noaa";
import { isValidImmutableMarketPricingTerms } from "../../shared/market-pricing";

export const SKYT_DECIMALS = 6;
export const MARKET_LIMITS = { maxLiquidity: BigInt(10_000_000_000), maxExposure: BigInt(8_000_000_000), perWallet: BigInt(500_000_000) } as const;

export type TriggerOperator = "gt" | "gte" | "lt" | "lte";
export interface QuoteRequest { city: SkyHedgeCity; stationId: string; observationStart: string; observationEnd: string; thresholdMm: number; operator: TriggerOperator; protectedAmount: bigint; }
export interface Quote { probabilityBps: number; premiumRateBps: number; premium: bigint; protocolFee: bigint; inputsHash: string; modelVersion: "noaa-rain-v1"; historicalWindows: number; forecastWeight: number; }

/** Price exactly what an immutable on-chain market will charge; never reprice a seeded market from a fresh forecast. */
export function quoteFromCommittedMarketTerms(input: { protectedAmount: bigint; probabilityBps: number; premiumRateBps: number; inputsHash: string }): Quote {
  const { protectedAmount: _protectedAmount, ...terms } = input;
  if (!isValidImmutableMarketPricingTerms(terms)) {
    throw new DataUnavailableError("The finalized market pricing terms or committed quote evidence are invalid.");
  }
  return {
    probabilityBps: input.probabilityBps,
    premiumRateBps: input.premiumRateBps,
    premium: ceilBps(input.protectedAmount, input.premiumRateBps),
    protocolFee: ceilBps(input.protectedAmount, 100),
    inputsHash: input.inputsHash,
    modelVersion: "noaa-rain-v1",
    historicalWindows: 10,
    forecastWeight: 0.3,
  };
}

export class RainfallQuoteEngine {
  constructor(private readonly provider: RainfallProvider) {}

  async quote(request: QuoteRequest): Promise<Quote> {
    validateQuoteRequest(request);
    const historical: Array<{ yearsAgo: number; start: string; endExclusive: string; records: DailyRainfall[]; totalMm: number }> = [];
    for (let yearsAgo = 1; yearsAgo <= 10; yearsAgo++) {
      historical.push(await this.analogueWindow(request, yearsAgo));
    }
    const historicProbability = Math.round((historical.filter((window) => matches(window.totalMm, request.operator, request.thresholdMm)).length / 10) * 10_000);
    const forecastRecords = validateDailyWindow(
      await retryNoaaRateLimit(() => this.provider.forecastRainfall(request.city, request.observationStart, request.observationEnd)),
      request.observationStart,
      request.observationEnd,
    );
    const forecast = cumulativeMillimeters(forecastRecords);
    // V1 has a deliberately deterministic forecast signal: triggered=100%, otherwise=0%.
    const forecastProbability = matches(forecast, request.operator, request.thresholdMm) ? 10_000 : 0;
    const probabilityBps = clamp(Math.round(historicProbability * 0.7 + forecastProbability * 0.3), 100, 9_000);
    const premiumRateBps = Math.ceil((probabilityBps * 11_500) / 10_000) + 100;
    const premium = ceilBps(request.protectedAmount, premiumRateBps);
    const protocolFee = ceilBps(request.protectedAmount, 100);
    const inputsHash = canonicalSourceHash({
      schema: "skyhedge-noaa-quote-inputs-v1",
      city: request.city,
      stationId: request.stationId,
      observationStart: request.observationStart,
      observationEndExclusive: request.observationEnd,
      thresholdMm: request.thresholdMm,
      operator: request.operator,
      historicalWindows: historical,
      forecast: { records: forecastRecords, cumulativeMm: forecast },
      pricing: {
        historicalProbabilityBps: historicProbability,
        forecastProbabilityBps: forecastProbability,
        historicalWeightBps: 7_000,
        forecastWeightBps: 3_000,
        probabilityBps,
        premiumRateBps,
        modelVersion: "noaa-rain-v1",
      },
    });
    return { probabilityBps, premiumRateBps, premium, protocolFee, inputsHash, modelVersion: "noaa-rain-v1", historicalWindows: 10, forecastWeight: 0.3 };
  }

  private async analogueWindow(request: QuoteRequest, yearsAgo: number): Promise<{ yearsAgo: number; start: string; endExclusive: string; records: DailyRainfall[]; totalMm: number }> {
    const start = withYear(request.observationStart, new Date(request.observationStart).getUTCFullYear() - yearsAgo);
    const endExclusive = withYear(request.observationEnd, new Date(request.observationEnd).getUTCFullYear() - yearsAgo);
    const endInclusive = previousUtcDay(endExclusive);
    const daily = await retryNoaaRateLimit(() => this.provider.dailyRainfall(request.stationId, start, endInclusive));
    const records = validateDailyWindow(daily, start, endExclusive);
    return { yearsAgo, start, endExclusive, records, totalMm: cumulativeMillimeters(records) };
  }
}

async function retryNoaaRateLimit<T>(read: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await read(); }
    catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!/\b429\b|rate.?limit/i.test(message) || attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400 * (2 ** attempt)));
    }
  }
}

function withYear(date: string, year: number): string { const parsed = new Date(`${date}T00:00:00Z`); parsed.setUTCFullYear(year); return parsed.toISOString().slice(0, 10); }
function previousUtcDay(date: string): string { const parsed = new Date(`${date}T00:00:00Z`); parsed.setUTCDate(parsed.getUTCDate() - 1); return parsed.toISOString().slice(0, 10); }
function validateDailyWindow(records: DailyRainfall[], start: string, endExclusive: string): DailyRainfall[] {
  const expected: string[] = [];
  for (let date = start; date < endExclusive; ) {
    expected.push(date);
    const next = new Date(`${date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    date = next.toISOString().slice(0, 10);
  }
  if (!records.length || records.length !== expected.length) throw new Error("NOAA quote inputs do not cover every day in the observation window.");
  const dates = new Set<string>();
  for (const record of records) {
    if (!record || !Number.isFinite(record.millimeters) || record.millimeters < 0 || !expected.includes(record.date) || dates.has(record.date)) {
      throw new Error("NOAA quote inputs contain an invalid, duplicate, or out-of-window daily value.");
    }
    dates.add(record.date);
  }
  if (dates.size !== expected.length) throw new Error("NOAA quote inputs do not cover every day in the observation window.");
  return [...records].sort((left, right) => left.date.localeCompare(right.date));
}

function validateQuoteRequest(request: QuoteRequest): void {
  const station = NOAA_STATIONS[request.city];
  if (!station || request.stationId !== station.stationId) throw new Error("Quote station does not match the pinned NOAA station for this market.");
  if (!Number.isFinite(request.thresholdMm) || request.thresholdMm <= 0) throw new Error("Quote rainfall threshold must be a positive finite millimetre value.");
  if (!Number.isSafeInteger(Number(request.protectedAmount)) || request.protectedAmount <= 0n) throw new Error("Quote protection amount must be a positive base-unit integer.");
  const start = parseUtcDate(request.observationStart);
  const end = parseUtcDate(request.observationEnd);
  if (start >= end) throw new Error("Quote observation window must be a nonempty half-open UTC date range.");
}

function parseUtcDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Quote observation dates must use YYYY-MM-DD UTC dates.");
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) throw new Error("Quote observation window contains an invalid UTC date.");
  return parsed;
}
function matches(value: number, operator: TriggerOperator, threshold: number): boolean { return operator === "gt" ? value > threshold : operator === "gte" ? value >= threshold : operator === "lt" ? value < threshold : value <= threshold; }
function clamp(value: number, minimum: number, maximum: number): number { return Math.min(Math.max(value, minimum), maximum); }
function ceilBps(value: bigint, bps: number): bigint { return (value * BigInt(bps) + BigInt(9_999)) / BigInt(10_000); }
