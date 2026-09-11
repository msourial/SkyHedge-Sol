import { canonicalSourceHash, cumulativeMillimeters, type DailyRainfall, type RainfallProvider, type SkyHedgeCity } from "./noaa";

export const SKYT_DECIMALS = 6;
export const MARKET_LIMITS = { maxLiquidity: BigInt(10_000_000_000), maxExposure: BigInt(8_000_000_000), perWallet: BigInt(500_000_000) } as const;

export type TriggerOperator = "gt" | "gte" | "lt" | "lte";
export interface QuoteRequest { city: SkyHedgeCity; stationId: string; observationStart: string; observationEnd: string; thresholdMm: number; operator: TriggerOperator; protectedAmount: bigint; }
export interface Quote { probabilityBps: number; premiumRateBps: number; premium: bigint; protocolFee: bigint; inputsHash: string; modelVersion: "noaa-rain-v1"; historicalWindows: number; forecastWeight: number; }

export class RainfallQuoteEngine {
  constructor(private readonly provider: RainfallProvider) {}

  async quote(request: QuoteRequest): Promise<Quote> {
    const historical = await Promise.all([...Array(10)].map((_, index) => this.analogueWindow(request, index + 1)));
    const historicProbability = Math.round((historical.filter((value) => matches(value, request.operator, request.thresholdMm)).length / 10) * 10_000);
    const forecast = cumulativeMillimeters(await this.provider.forecastRainfall(request.city, request.observationStart, request.observationEnd));
    // V1 has a deliberately deterministic forecast signal: triggered=100%, otherwise=0%.
    const forecastProbability = matches(forecast, request.operator, request.thresholdMm) ? 10_000 : 0;
    const probabilityBps = clamp(Math.round(historicProbability * 0.7 + forecastProbability * 0.3), 100, 9_000);
    const premiumRateBps = Math.ceil((probabilityBps * 11_500) / 10_000) + 100;
    const premium = ceilBps(request.protectedAmount, premiumRateBps);
    const protocolFee = ceilBps(request.protectedAmount, 100);
    return { probabilityBps, premiumRateBps, premium, protocolFee, inputsHash: canonicalSourceHash({ request: { ...request, protectedAmount: request.protectedAmount.toString() }, historicProbability, forecast, probabilityBps, modelVersion: "noaa-rain-v1" }), modelVersion: "noaa-rain-v1", historicalWindows: 10, forecastWeight: 0.3 };
  }

  private async analogueWindow(request: QuoteRequest, yearsAgo: number): Promise<number> {
    const start = withYear(request.observationStart, new Date(request.observationStart).getUTCFullYear() - yearsAgo);
    const end = withYear(request.observationEnd, new Date(request.observationEnd).getUTCFullYear() - yearsAgo);
    const daily = await this.provider.dailyRainfall(request.stationId, start, end);
    return cumulativeMillimeters(daily);
  }
}

function withYear(date: string, year: number): string { const parsed = new Date(`${date}T00:00:00Z`); parsed.setUTCFullYear(year); return parsed.toISOString().slice(0, 10); }
function matches(value: number, operator: TriggerOperator, threshold: number): boolean { return operator === "gt" ? value > threshold : operator === "gte" ? value >= threshold : operator === "lt" ? value < threshold : value <= threshold; }
function clamp(value: number, minimum: number, maximum: number): number { return Math.min(Math.max(value, minimum), maximum); }
function ceilBps(value: bigint, bps: number): bigint { return (value * BigInt(bps) + BigInt(9_999)) / BigInt(10_000); }
