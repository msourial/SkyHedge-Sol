import { expect } from "chai";
import { poolApy, insightFactors } from "./dashboard-stats";

describe("Dashboard stats (pure logic)", () => {
  it("annualizes weekly premium yield against deployed liquidity", () => {
    expect(poolApy(1000, 1_000_000n * 100n, 1_000_000n * 1000n, 7)).to.eq(52.1);
    expect(poolApy(0, 1_000_000n * 100n, 1_000_000n * 1000n, 7)).to.eq(0);
  });

  it("returns 0 APY when the pool is empty", () => {
    expect(poolApy(5000, 1_000_000n * 10n, 0n, 14)).to.eq(0);
  });

  it("classifies factors wet/dry only from real observations", () => {
    const base = { name: "Miami", windowNormalMm: 100, probabilitySource: "climatology-prior" as const };
    const factors = insightFactors([
      { slug: "miami", cumulativeMm: 140, ...base },
      { slug: "chicago", cumulativeMm: 60, ...base },
      { slug: "new-york", cumulativeMm: null, ...base },
    ]);
    expect(factors[0].factor).to.eq("wet");
    expect(factors[0].deviationPct).to.eq(40);
    expect(factors[1].factor).to.eq("dry");
    expect(factors[2].factor).to.eq("neutral");
    expect(factors[2].source).to.eq("climatology-prior");
  });

  it("keeps near-normal observations neutral", () => {
    const f = insightFactors([{ slug: "nyc", name: "New York", cumulativeMm: 104, windowNormalMm: 100, probabilitySource: "noaa-observed" as const }]);
    expect(f[0].factor).to.eq("neutral");
  });
});
