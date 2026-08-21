import { expect } from "chai";
import { chainWindowsFrom, premiumBps, priceChainOption, strikeSetFor } from "./chain-pricing";
import { cityBySlug, windowNormalMm } from "../../shared/cities";

describe("Chain pricing engine (offline: no NOAA_TOKEN -> climatology prior)", () => {
  it("builds a deduped ascending 5-strike set around the window normal", () => {
    const strikes = strikeSetFor(50);
    expect(strikes).to.deep.eq([25, 40, 50, 65, 75]);
  });

  it("clamps strikes to a 5mm floor and dedupes", () => {
    const strikes = strikeSetFor(5);
    expect(strikes[0]).to.eq(5);
    expect(strikes.length).to.be.lessThanOrEqual(5);
    expect(new Set(strikes).size).to.eq(strikes.length);
  });

  it("loads premiums as probability x 1.15 loading + 100 bps fee", () => {
    expect(premiumBps(5000)).to.eq(5850);
    expect(premiumBps(100)).to.eq(215);
    expect(premiumBps(9000)).to.eq(10450);
  });

  it("emits 4 consecutive Monday-to-Monday weekly windows", () => {
    const windows = chainWindowsFrom(new Date("2026-08-19T12:00:00Z"), 4);
    expect(windows.length).to.eq(4);
    const starts = windows.map((w) => w.start.toISOString().slice(0, 10));
    expect(starts).to.deep.eq(["2026-08-17", "2026-08-24", "2026-08-31", "2026-09-07"]);
    for (const w of windows) {
      expect(w.start.getUTCDay()).to.eq(1);
      expect(w.end.getTime() - w.start.getTime()).to.eq(7 * 86_400_000);
    }
  });

  it("prices with the climatology prior when NOAA is unavailable", async () => {
    const mumbai = cityBySlug("mumbai")!;
    const window = chainWindowsFrom(new Date(), 4)[1];
    const price = await priceChainOption(mumbai, window, 100, "call");
    expect(price.probabilitySource).to.eq("climatology-prior");
    expect(price.modelVersion).to.eq("rain-gamma-v1");
    expect(price.historicalWindows).to.eq(0);
    expect(price.probabilityBps).to.be.within(100, 9000);
    expect(price.normalMm).to.eq(windowNormalMm(mumbai, window.start.getTime(), window.end.getTime()));
    expect(price.premiumRateBps).to.eq(premiumBps(price.probabilityBps));
  });

  it("keeps call and put probabilities complementary at the money", async () => {
    const mumbai = cityBySlug("mumbai")!;
    const window = chainWindowsFrom(new Date(), 4)[1];
    const normal = windowNormalMm(mumbai, window.start.getTime(), window.end.getTime());
    const call = await priceChainOption(mumbai, window, normal, "call");
    const put = await priceChainOption(mumbai, window, normal, "put");
    expect(Math.abs(call.probabilityBps + put.probabilityBps - 10_000)).to.be.lessThan(100);
  });

  it("orders call probabilities by strike (lower strike -> higher call probability)", async () => {
    const mumbai = cityBySlug("mumbai")!;
    const window = chainWindowsFrom(new Date(), 4)[1];
    const low = await priceChainOption(mumbai, window, 50, "call");
    const high = await priceChainOption(mumbai, window, 200, "call");
    expect(low.probabilityBps).to.be.greaterThan(high.probabilityBps);
  });

  it("clamps probabilities for near-certain events (arid city)", async () => {
    const cairo = cityBySlug("cairo")!;
    const window = chainWindowsFrom(new Date(), 4)[1];
    const call = await priceChainOption(cairo, window, 20, "call");
    const put = await priceChainOption(cairo, window, 20, "put");
    expect(put.probabilityBps).to.be.greaterThan(8_000);
    expect(call.probabilityBps).to.be.lessThan(1_000);
  });
});