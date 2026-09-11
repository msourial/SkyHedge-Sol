import { expect } from "chai";
import { RainfallConsensusService } from "./consensus";

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
    expect(result.evidence.rule).to.eq("NOAA final observation");
    expect(result.evidence.sourceHash).to.match(/^[a-f0-9]{64}$/);
  });
});
