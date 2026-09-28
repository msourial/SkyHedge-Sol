import { expect } from "chai";
import methodology from "../../shared/methodology-v1.json";
import { canonicalSourceHash, NOAA_STATIONS } from "./noaa";
import { clearDesMoinesEvidenceCache, finalizedEvidenceWindow, getDesMoinesEvidencePackage } from "./des-moines-evidence";

describe("Des Moines evidence window", () => {
  it("uses a completed seven-day window with a seven-day NOAA final-data lag", () => {
    expect(finalizedEvidenceWindow(new Date("2026-09-21T12:00:00.000Z"))).to.deep.equal({
      start: "2026-09-07",
      end: "2026-09-14",
    });
  });

  it("reuses a real, hashed NOAA package briefly when NOAA rate-limits a repeat read", async () => {
    clearDesMoinesEvidenceCache();
    const range = finalizedEvidenceWindow();
    const verifiedService = {
      evidenceFor: async () => ({
        verdict: "AGREED",
        finalValueMm: 177.3,
        evidence: {
          sourceHash: "55".repeat(32),
          city: "des-moines",
          windowStart: range.start,
          windowEnd: range.end,
          noaa: { stationId: NOAA_STATIONS["des-moines"].stationId, cumulativeMm: 177.3, records: [] },
        },
      }),
    };
    const verified = await getDesMoinesEvidencePackage(range, verifiedService as never, undefined, { quote: async () => { throw new Error("forecast unavailable"); } } as never);
    expect(verified.stationId).to.equal(NOAA_STATIONS["des-moines"].stationId);
    expect(verified.stationIdHash).to.equal(canonicalSourceHash(verified.stationId));
    expect(verified.providerHash).to.equal(canonicalSourceHash(methodology));
    expect(verified.methodologyHash).to.equal(canonicalSourceHash(methodology.version));
    expect(verified.quoteTerms).to.equal(null);
    const rateLimitedService = { evidenceFor: async () => { throw new Error("NOAA final observations unavailable (429)"); } };

    const cached = await getDesMoinesEvidencePackage(range, rateLimitedService as never);
    expect(cached).to.deep.equal(verified);
    clearDesMoinesEvidenceCache();
  });

  it("prices only the exact five-day schedule returned to the wallet seed builder", async () => {
    clearDesMoinesEvidenceCache();
    const range = finalizedEvidenceWindow();
    const schedule = { salesCloseAt: 1_800_000_000, observationStart: 1_800_057_600, observationEnd: 1_800_489_600 };
    let quoteRequest: Record<string, unknown> | undefined;
    const service = {
      evidenceFor: async () => ({
        verdict: "AGREED", finalValueMm: 25.4,
        evidence: { sourceHash: "ab".repeat(32), city: "des-moines", windowStart: range.start, windowEnd: range.end, noaa: { stationId: NOAA_STATIONS["des-moines"].stationId, cumulativeMm: 25.4, records: [] } },
      }),
    };
    const quoteEngine = { quote: async (request: Record<string, unknown>) => {
      quoteRequest = request;
      return { probabilityBps: 2_000, premiumRateBps: 2_400, inputsHash: "cd".repeat(32) };
    } };
    const pkg = await getDesMoinesEvidencePackage(range, service as never, schedule, quoteEngine as never);

    expect(pkg.seedSchedule).to.deep.equal(schedule);
    expect(quoteRequest).to.include({
      city: "des-moines", stationId: NOAA_STATIONS["des-moines"].stationId,
      observationStart: new Date(schedule.observationStart * 1_000).toISOString().slice(0, 10),
      observationEnd: new Date(schedule.observationEnd * 1_000).toISOString().slice(0, 10),
      thresholdMm: 50, operator: "gte",
    });
    expect(pkg.quoteTerms).to.deep.equal({ probabilityBps: 2_000, premiumRateBps: 2_400, inputsHash: "cd".repeat(32) });
    clearDesMoinesEvidenceCache();
  });

  it("reuses NOAA pricing for the same observation dates while refreshing the sales deadline", async () => {
    clearDesMoinesEvidenceCache();
    const range = finalizedEvidenceWindow();
    const firstSchedule = { salesCloseAt: 1_800_000_000, observationStart: 1_800_057_600, observationEnd: 1_800_489_600 };
    const refreshedSchedule = { ...firstSchedule, salesCloseAt: firstSchedule.salesCloseAt + 600 };
    let historicalCalls = 0;
    let quoteCalls = 0;
    const service = { evidenceFor: async () => {
      historicalCalls++;
      return { verdict: "AGREED", finalValueMm: 1, evidence: { sourceHash: "ba".repeat(32), city: "des-moines", windowStart: range.start, windowEnd: range.end, noaa: { stationId: NOAA_STATIONS["des-moines"].stationId, cumulativeMm: 1, records: [] } } };
    } };
    const quoteEngine = { quote: async () => { quoteCalls++; return { probabilityBps: 2_000, premiumRateBps: 2_400, inputsHash: "dc".repeat(32) }; } };
    await getDesMoinesEvidencePackage(range, service as never, firstSchedule, quoteEngine as never);
    const cached = await getDesMoinesEvidencePackage(range, service as never, refreshedSchedule, quoteEngine as never);
    expect(historicalCalls).to.equal(1);
    expect(quoteCalls).to.equal(1);
    expect(cached.seedSchedule).to.deep.equal(refreshedSchedule);
    clearDesMoinesEvidenceCache();
  });

  it("keeps station validation visible but leaves pricing unavailable when exact NOAA QPF is incomplete", async () => {
    clearDesMoinesEvidenceCache();
    const range = finalizedEvidenceWindow();
    const service = { evidenceFor: async () => ({ verdict: "AGREED", finalValueMm: 1, evidence: { sourceHash: "ef".repeat(32), city: "des-moines", windowStart: range.start, windowEnd: range.end, noaa: { stationId: NOAA_STATIONS["des-moines"].stationId, cumulativeMm: 1, records: [] } } }) };
    const pkg = await getDesMoinesEvidencePackage(range, service as never, undefined, { quote: async () => { throw new Error("forecast missing a day"); } } as never);
    expect(pkg.validated).to.equal(true);
    expect(pkg.quoteTerms).to.equal(null);
    clearDesMoinesEvidenceCache();
  });

  it("rejects arbitrary evidence windows before making NOAA requests", async () => {
    clearDesMoinesEvidenceCache();
    let called = false;
    const service = { evidenceFor: async () => { called = true; throw new Error("unexpected NOAA request"); } };
    let message = "";
    try { await getDesMoinesEvidencePackage({ start: "2099-01-01", end: "2099-01-08" }, service as never); }
    catch (error) { message = error instanceof Error ? error.message : ""; }
    expect(message).to.equal("Only the server-selected, completed Des Moines evidence window is permitted.");
    expect(called).to.equal(false);
    clearDesMoinesEvidenceCache();
  });

});
