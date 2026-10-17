import { expect } from "chai";
import { assertDevnetKeeperTarget, TEST_SKYT_MINT } from "./window-keeper";
import {
  expiryLabel,
  historicHitBps,
  marketsOpenLabel,
  NEXT_WINDOW_COPY,
  LIVE_CITY_SLUGS,
  OPENING_SHORTLY,
  windowsOpenChip,
  openLadder,
  planCityLadders,
  planLadderRoll,
  priceFromSignals,
  strikeFromAnalogueTotals,
  tenorOf,
  type LadderWindow,
} from "../../shared/window-ladder";

/** Saturday 2026-10-17 02:00 UTC — the evening of Friday Oct 16 in US Eastern. */
const NOW = Date.UTC(2026, 9, 17, 2, 0, 0) / 1_000;

describe("rolling window ladder", () => {
  it("keeps the next two weekly and monthly expiries open, closing sales at the start", () => {
    const ladder = openLadder(NOW);
    expect(ladder.map(labelOf)).to.deep.equal([
      "weekly Week of Oct 19",
      "weekly Week of Oct 26",
      "monthly November",
      "monthly December",
    ]);
    for (const window of ladder) {
      expect(window.salesCloseAt).to.equal(window.observationStart);
      expect(window.observationStart).to.be.greaterThan(NOW);
      expect(tenorOf(window.observationStart, window.observationEnd)).to.equal(window.tenor);
    }
    const october = Date.UTC(2026, 9, 1) / 1_000;
    expect(tenorOf(october, Date.UTC(2026, 10, 1) / 1_000)).to.equal("monthly");
    expect(openLadder(october - 1).some((window) => window.observationStart === october)).to.equal(true);
    expect(openLadder(october).some((window) => window.observationStart === october)).to.equal(false);
  });

  it("rolls a closed rung off and adds the far one without duplicating an existing window", () => {
    const [firstWeek, secondWeek, november, december] = openLadder(NOW);
    const afterFirstWeek = firstWeek.observationStart;
    const rolled = openLadder(afterFirstWeek);
    expect(rolled.map((window) => window.observationStart)).to.deep.equal([
      secondWeek.observationStart,
      secondWeek.observationStart + 7 * 86_400,
      november.observationStart,
      december.observationStart,
    ]);

    const existing = [market(firstWeek, "open"), market(november, "open")];
    const once = planLadderRoll(existing, NOW);
    expect(once.map((step) => step.window.observationStart)).to.deep.equal([
      secondWeek.observationStart,
      december.observationStart,
    ]);
    expect(once.every((step) => step.action === "create-fund-open")).to.equal(true);
    const filled = planLadderRoll([
      ...existing,
      market(secondWeek, "open"),
      market(december, "draft", "0"),
      market(december, "draft", "0"),
    ], NOW);
    expect(filled.map((step) => step.action)).to.deep.equal(["fund-open"]);
    expect(planLadderRoll([
      market(firstWeek, "open"),
      market(secondWeek, "cancelled"),
      market(secondWeek, "open"),
      market(november, "open"),
      market(december, "open"),
    ], NOW)).to.deep.equal([]);
  });

  it("sets a higher monthly strike only from real analogue totals", () => {
    const weeklyTotals = [1, 2, 3, 4, 5, 6, 7, 12.2, 20, 30];
    const monthlyTotals = [10, 20, 30, 40, 50, 60, 70, 80.1, 90, 100];
    const weeklyStrike = strikeFromAnalogueTotals(weeklyTotals);
    const monthlyStrike = strikeFromAnalogueTotals(monthlyTotals);
    expect(weeklyStrike).to.equal(13);
    expect(monthlyStrike).to.equal(81);
    expect(monthlyStrike!).to.be.greaterThan(weeklyStrike!);
    expect(strikeFromAnalogueTotals([0, 0, 0, 0, 0, 0, 0, 0, 1, 2])).to.equal(null);
    expect(strikeFromAnalogueTotals(weeklyTotals.slice(0, 9))).to.equal(null);
    expect(historicHitBps(weeklyTotals, weeklyStrike!)).to.equal(2_000);
    expect(priceFromSignals(3_000, 10_000)).to.deep.equal({ probabilityBps: 5_100, premiumRateBps: 5_965, forecastWeight: 0.3 });
    expect(priceFromSignals(3_000, null)).to.deep.equal({ probabilityBps: 3_000, premiumRateBps: 3_550, forecastWeight: 0 });
  });

  it("keeps each live city's ladder separate, with New York first", () => {
    expect(LIVE_CITY_SLUGS).to.deep.equal([
      "new-york", "chicago", "miami", "dallas", "los-angeles", "seattle", "boston", "austin", "des-moines",
    ]);
    const [firstWeek] = openLadder(NOW);
    const steps = planCityLadders([{ ...market(firstWeek, "open"), city: "des-moines" }], NOW);
    expect(steps.filter((step) => step.city === "dallas")).to.have.length(4);
    expect(steps.filter((step) => step.city === "new-york")).to.have.length(4);
    expect(steps.filter((step) => step.city === "des-moines").map((step) => step.window.observationStart)).to.not.include(firstWeek.observationStart);
    expect(steps[0]?.city).to.equal("new-york");
  });

  it("paints Weekly · Monthly open only when both rungs are present", () => {
    expect(windowsOpenChip(["weekly", "monthly"])).to.deep.equal({ label: "Weekly · Monthly open", tone: "live" });
    expect(windowsOpenChip(["weekly"])).to.deep.equal({ label: OPENING_SHORTLY, tone: "soon" });
    expect(windowsOpenChip([])).to.deep.equal({ label: OPENING_SHORTLY, tone: "soon" });
  });

  it("never describes an empty ladder as a closed sale", () => {
    expect(marketsOpenLabel(["weekly", "monthly"])).to.equal("Weekly · Monthly open");
    expect(marketsOpenLabel([])).to.equal(NEXT_WINDOW_COPY);
    expect(NEXT_WINDOW_COPY.toLowerCase()).to.not.include("isn't selling");
    expect(NEXT_WINDOW_COPY.toLowerCase()).to.not.include("sales closed");
  });

  it("refuses mainnet and any mint other than test SKYT", () => {
    expect(() => assertDevnetKeeperTarget("https://api.mainnet-beta.solana.com", TEST_SKYT_MINT)).to.throw(/Devnet/);
    expect(() => assertDevnetKeeperTarget("https://api.devnet.solana.com", "other-mint")).to.throw(/SKYT/);
    expect(() => assertDevnetKeeperTarget("https://api.devnet.solana.com", TEST_SKYT_MINT)).to.not.throw();
  });
});

function labelOf(window: LadderWindow): string {
  return `${window.tenor} ${expiryLabel(window)}`;
}

function market(window: LadderWindow, state: "open" | "draft" | "cancelled", vault = "2000000000") {
  return {
    marketId: `${window.observationStart}`,
    address: `addr-${window.observationStart}`,
    state,
    salesCloseAt: window.salesCloseAt,
    observationStart: window.observationStart,
    observationEnd: window.observationEnd,
    vaultBalanceBase: vault,
  };
}
