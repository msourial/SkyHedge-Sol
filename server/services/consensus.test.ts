import { expect } from "chai";
import { RainfallConsensusService, utcDailyObservationRange } from "./consensus";

describe("NOAA-only settlement evidence", () => {
  it("commits the pinned NOAA station and a deterministic source hash", async () => {
    const provider = { dailyRainfall: async () => [
      { date: "2026-01-01", millimeters: 3.25 },
      { date: "2026-01-02", millimeters: 1.75 },
    ] };
    const service = new RainfallConsensusService(provider as never);
    const result = await service.evidenceFor("new-york", "2026-01-01", "2026-01-02");
    expect(result.verdict).to.eq("AGREED");
    expect(result.finalValueMm).to.eq(5);
    expect(result.evidence.noaa.stationId).to.eq("GHCND:USW00094728");
    expect(result.evidence.rule).to.eq("NOAA quality-screened daily observation");
    expect(result.evidence.sourceHash).to.match(/^[a-f0-9]{64}$/);
    const retry = await service.evidenceFor("new-york", "2026-01-01", "2026-01-02");
    expect(retry.evidence.sourceHash).to.eq(result.evidence.sourceHash);
  });

  it("rejects missing daily NOAA records instead of treating partial rainfall as final", async () => {
    const provider = { dailyRainfall: async () => [
      { date: "2026-01-01", millimeters: 3.25 },
      { date: "2026-01-03", millimeters: 1.75 },
    ] };
    const service = new RainfallConsensusService(provider as never);
    const error = await captureError(() => service.evidenceFor("new-york", "2026-01-01", "2026-01-03"));
    expect(error?.message).to.contain("incomplete");
  });

  it("rejects duplicate, out-of-window, and malformed NOAA daily values", async () => {
    const cases = [
      [
        { date: "2026-01-01", millimeters: 1 },
        { date: "2026-01-01", millimeters: 2 },
      ],
      [
        { date: "2025-12-31", millimeters: 1 },
        { date: "2026-01-01", millimeters: 2 },
      ],
      [
        { date: "2026-01-01", millimeters: Number.NaN },
        { date: "2026-01-02", millimeters: 2 },
      ],
    ];
    for (const records of cases) {
      const service = new RainfallConsensusService({ dailyRainfall: async () => records } as never);
      const error = await captureError(() => service.evidenceFor("new-york", "2026-01-01", "2026-01-02"));
      expect(error?.message).to.match(/duplicate|outside|malformed|incomplete/i);
    }
  });

  it("rejects failed quality checks and measurements that cannot be assigned to a daily window", async () => {
    const invalidRecords = [
      { date: "2026-01-01", millimeters: 1, qualityFlag: "O" },
      { date: "2026-01-01", millimeters: 1, measurementFlag: "A" },
    ];
    for (const record of invalidRecords) {
      const service = new RainfallConsensusService({ dailyRainfall: async () => [
        record,
        { date: "2026-01-02", millimeters: 2 },
      ] } as never);
      const error = await captureError(() => service.evidenceFor("new-york", "2026-01-01", "2026-01-02"));
      expect(error?.message).to.match(/quality flag|measurement flag/i);
    }
  });

  it("maps a half-open UTC market window to the exact included NOAA dates", () => {
    expect(utcDailyObservationRange(
      Date.parse("2026-09-01T00:00:00Z") / 1_000,
      Date.parse("2026-09-08T00:00:00Z") / 1_000,
    )).to.deep.eq({ start: "2026-09-01", end: "2026-09-07" });
  });
});

async function captureError(run: () => Promise<unknown>): Promise<Error | null> {
  try { await run(); return null; }
  catch (error) { return error instanceof Error ? error : new Error(String(error)); }
}
