import { expect } from "chai";
import { confirmSentence, marketStatus, notTriggeredLine, payGet, protectCta } from "../../shared/pay-get";

describe("pay and get", () => {
  it("prices 100 SKYT of cover at 2400 bps as 24.00 paid and 4.1× back", () => {
    const quote = payGet({ coverageSkyt: 100, premiumRateBps: 2_400, probabilityBps: 2_000 });
    expect(quote).to.deep.equal({
      payBase: "24000000",
      getBase: "100000000",
      payLabel: "24.00",
      getLabel: "100",
      multiple: "4.1×",
      chance: "20.0%",
    });
  });

  it("scales the same rate to the 50 and 250 chips without rounding the multiple up", () => {
    expect(payGet({ coverageSkyt: 50, premiumRateBps: 2_400, probabilityBps: 2_000 })?.payLabel).to.equal("12.00");
    expect(payGet({ coverageSkyt: 250, premiumRateBps: 2_400, probabilityBps: 2_000 })?.payLabel).to.equal("60.00");
    expect(payGet({ coverageSkyt: 50, premiumRateBps: 2_400, probabilityBps: 2_000 })?.multiple).to.equal("4.1×");
    expect(payGet({ coverageSkyt: 0, premiumRateBps: 2_400, probabilityBps: 2_000 })).to.equal(null);
  });

  it("names the disabled reason and the live call to action", () => {
    const quote = payGet({ coverageSkyt: 100, premiumRateBps: 2_400, probabilityBps: 2_000 });
    expect(protectCta({ connected: false, quote, thresholdMm: 29 })).to.equal("Connect wallet");
    expect(protectCta({ connected: true, quote: null, thresholdMm: null })).to.equal("Pick a trigger");
    expect(protectCta({ connected: true, quote, thresholdMm: 29 })).to.equal("Protect 24.00 SKYT · get 100 if ≥29 mm");
  });

  it("states a miss and a confirm sentence only from real figures", () => {
    expect(notTriggeredLine(12, 29)).to.equal("Not triggered: 12 of 29 mm");
    expect(notTriggeredLine(29, 29)).to.equal(null);
    expect(confirmSentence({ thresholdMm: 29, station: "NOAA Central Park", expiry: "Oct 25", getLabel: "100" }))
      .to.equal("If ≥29 mm falls at Central Park by Oct 25, you get 100 SKYT");
  });

  it("uses Open, a real open date, or Closed and never invents a date", () => {
    const now = 1_700_000_000;
    expect(marketStatus([{ salesCloseAt: now + 100, observationStart: now - 10 }], now)).to.deep.equal({ tone: "open", label: "Open" });
    expect(marketStatus([{ salesCloseAt: null, observationStart: Date.parse("2026-11-02T00:00:00Z") / 1000 }], Date.parse("2026-10-19T00:00:00Z") / 1000).label).to.equal("Opens Nov 2");
    expect(marketStatus([{ salesCloseAt: now - 10, observationStart: now - 100 }], now)).to.deep.equal({ tone: "closed", label: "Closed" });
    expect(marketStatus([], now)).to.equal(null);
  });
});
