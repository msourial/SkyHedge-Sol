import { expect } from "chai";
import { poolApy, insightFactors } from "./dashboard-stats";
import { GovernanceStore } from "./governance";

describe("Dashboard stats (pure logic)", () => {
  it("annualizes weekly premium yield against deployed liquidity", () => {
    expect(poolApy(1000, 1_000_000n * 100n, 1_000_000n * 1000n, 7)).to.eq(52.1);
    expect(poolApy(0, 1_000_000n * 100n, 1_000_000n * 1000n, 7)).to.eq(0);
  });

  it("returns 0 APY when the pool is empty", () => {
    expect(poolApy(5000, 1_000_000n * 10n, 0n, 14)).to.eq(0);
  });

  it("classifies factors wet/dry only from real observations", () => {
    const base = { name: "Mumbai", windowNormalMm: 100, probabilitySource: "climatology-prior" as const };
    const factors = insightFactors([
      { slug: "mumbai", cumulativeMm: 140, ...base },
      { slug: "cairo", cumulativeMm: 60, ...base },
      { slug: "london", cumulativeMm: null, ...base },
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

describe("Governance store (in-memory mock)", () => {
  const store = new GovernanceStore();

  it("seeds proposals with statuses derived from deadlines", () => {
    const list = store.list();
    expect(list.length).to.be.greaterThanOrEqual(3);
    for (const p of list) {
      expect(p.status).to.be.oneOf(["active", "passed", "failed"]);
      expect(p.yes + p.no).to.eq(p.votes);
    }
  });

  it("creates a proposal and casts votes", () => {
    const created = store.create("new-york-call", "Test proposal", "Test description");
    expect(created.status).to.eq("active");
    expect(created.votes).to.eq(0);
    store.vote({ proposalId: created.id, support: true });
    store.vote({ proposalId: created.id, support: false });
    const updated = store.list().find((p) => p.id === created.id)!;
    expect(updated.yes).to.eq(1);
    expect(updated.no).to.eq(1);
    expect(updated.votes).to.eq(2);
  });

  it("rejects votes on unknown proposals", () => {
    expect(store.vote({ proposalId: "nope", support: true })).to.eq(null);
  });
});