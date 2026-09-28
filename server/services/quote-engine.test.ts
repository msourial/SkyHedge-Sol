import { expect } from "chai";
import { quoteFromCommittedMarketTerms, RainfallQuoteEngine } from "./quote-engine";

describe("rainfall quote windows", () => {
  it("prices using finalized market terms and rejects mismatched on-chain premium rates", () => {
    const quote = quoteFromCommittedMarketTerms({ protectedAmount: 100_000_000n, probabilityBps: 2_000, premiumRateBps: 2_400, inputsHash: "ab".repeat(32) });
    expect(quote.premium).to.equal(24_000_000n);
    expect(quote.inputsHash).to.equal("ab".repeat(32));
    expect(() => quoteFromCommittedMarketTerms({ protectedAmount: 100_000_000n, probabilityBps: 2_000, premiumRateBps: 2_401, inputsHash: "ab".repeat(32) })).to.throw(/pricing terms/i);
  });

  it("treats on-chain observationEnd as exclusive for all ten historical windows", async () => {
    const historicalRequests: Array<{ start: string; end: string }> = [];
    const forecastRequests: Array<{ start: string; end: string }> = [];
    const provider = {
      dailyRainfall: async (_station: string, start: string, end: string) => {
        historicalRequests.push({ start, end });
        return dates(start, end).map((date) => ({ date, millimeters: 0 }));
      },
      forecastRainfall: async (_city: string, start: string, end: string) => {
        forecastRequests.push({ start, end });
        return dates(start, previousDay(end)).map((date) => ({ date, millimeters: 0 }));
      },
    };
    const quote = await new RainfallQuoteEngine(provider as never).quote({
      city: "des-moines", stationId: "GHCND:USW00014933",
      observationStart: "2026-09-01", observationEnd: "2026-09-08",
      thresholdMm: 50, operator: "gte", protectedAmount: 100_000_000n,
    });

    expect(historicalRequests).to.have.length(10);
    expect(historicalRequests[0]).to.deep.equal({ start: "2025-09-01", end: "2025-09-07" });
    expect(forecastRequests).to.deep.equal([{ start: "2026-09-01", end: "2026-09-08" }]);
    expect(quote.inputsHash).to.match(/^[a-f0-9]{64}$/);
  });

  it("commits all normalized NOAA inputs and immutable contract terms, but not a user's amount", async () => {
    const makeProvider = (rainMm: number) => ({
      dailyRainfall: async (_station: string, start: string, end: string) => dates(start, end).map((date) => ({ date, millimeters: rainMm })),
      forecastRainfall: async (_city: string, start: string, end: string) => dates(start, previousDay(end)).map((date) => ({ date, millimeters: rainMm })),
    });
    const engine = new RainfallQuoteEngine(makeProvider(0) as never);
    const request = {
      city: "des-moines" as const, stationId: "GHCND:USW00014933",
      observationStart: "2026-09-01", observationEnd: "2026-09-06",
      thresholdMm: 50, operator: "gte" as const,
    };
    const small = await engine.quote({ ...request, protectedAmount: 10n });
    const large = await engine.quote({ ...request, protectedAmount: 1_000_000n });
    const changedSource = await new RainfallQuoteEngine(makeProvider(1) as never).quote({ ...request, protectedAmount: 10n });

    expect(small.inputsHash).to.equal(large.inputsHash);
    expect(small.inputsHash).not.to.equal(changedSource.inputsHash);
  });

  it("serializes historical NOAA reads and retries a rate-limited request only a bounded number of times", async () => {
    let active = 0;
    let maximumActive = 0;
    let firstAttempt = true;
    const provider = {
      dailyRainfall: async (_station: string, start: string, end: string) => {
        active++;
        maximumActive = Math.max(maximumActive, active);
        try {
          if (firstAttempt) { firstAttempt = false; throw new Error("NOAA station observations unavailable (429)"); }
          return dates(start, end).map((date) => ({ date, millimeters: 0 }));
        } finally { active--; }
      },
      forecastRainfall: async (_city: string, start: string, end: string) => dates(start, previousDay(end)).map((date) => ({ date, millimeters: 0 })),
    };
    await new RainfallQuoteEngine(provider as never).quote({
      city: "des-moines", stationId: "GHCND:USW00014933",
      observationStart: "2026-09-01", observationEnd: "2026-09-06",
      thresholdMm: 50, operator: "gte", protectedAmount: 100n,
    });
    expect(maximumActive).to.equal(1);
  });

  it("refuses incomplete historical quote inputs instead of pricing a partial window", async () => {
    const provider = {
      dailyRainfall: async () => [{ date: "2025-09-01", millimeters: 0 }],
      forecastRainfall: async () => [{ date: "2026-09-01", millimeters: 0 }],
    };
    let message = "";
    try {
      await new RainfallQuoteEngine(provider as never).quote({
        city: "des-moines", stationId: "GHCND:USW00014933",
        observationStart: "2026-09-01", observationEnd: "2026-09-08",
        thresholdMm: 50, operator: "gte", protectedAmount: 100_000_000n,
      });
    } catch (error) { message = error instanceof Error ? error.message : ""; }
    expect(message).to.match(/cover every day/i);
  });
});

function dates(start: string, endInclusive: string): string[] {
  const result: string[] = [];
  const current = new Date(`${start}T00:00:00Z`);
  const end = new Date(`${endInclusive}T00:00:00Z`);
  while (current <= end) { result.push(current.toISOString().slice(0, 10)); current.setUTCDate(current.getUTCDate() + 1); }
  return result;
}
function previousDay(date: string): string { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() - 1); return value.toISOString().slice(0, 10); }
