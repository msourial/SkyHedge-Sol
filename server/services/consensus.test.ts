import { expect } from "chai";
import { agree, CONSENSUS_RULE } from "./consensus";
import { median, sumAccumulated } from "./weatherxm";

describe("NOAA/WXM consensus rule (locked: |Δ| ≤ max(5mm, 15% of NOAA))", () => {
  it("commits the locked tolerance constants", () => {
    expect(CONSENSUS_RULE.agreementToleranceMm).to.eq(5);
    expect(CONSENSUS_RULE.agreementTolerancePct).to.eq(0.15);
  });

  it("agrees when delta is within the 5mm floor", () => {
    expect(agree(10, 14.9)).to.eq(true);
    expect(agree(10, 5.1)).to.eq(true);
    expect(agree(10, 15.01)).to.eq(false);
    expect(agree(10, 4.99)).to.eq(false);
  });

  it("agrees when delta is within 15% for large totals", () => {
    expect(agree(100, 114.9)).to.eq(true);
    expect(agree(100, 85.1)).to.eq(true);
    expect(agree(100, 115.1)).to.eq(false);
  });

  it("uses the wider of the two tolerances", () => {
    expect(agree(10, 15)).to.eq(true);
    expect(agree(100, 114.9)).to.eq(true);
    expect(agree(200, 230.1)).to.eq(false);
  });

  it("anchors tolerance to NOAA (final value), so the rule is asymmetric by design", () => {
    expect(agree(50, 42.5)).to.eq(true);
    expect(agree(42.5, 50)).to.eq(false);
    expect(agree(20, 23)).to.eq(true);
    expect(agree(23, 20)).to.eq(true);
  });
});

describe("WeatherXM precipitation counter reconstruction", () => {
  it("sums monotonic accumulation samples", () => {
    expect(sumAccumulated([0, 1.2, 2.4])).to.eq(2.4);
  });

  it("counts the first sample as accumulation since midnight", () => {
    expect(sumAccumulated([150, 152])).to.eq(152);
  });

  it("handles a counter reset as a fresh start", () => {
    expect(sumAccumulated([150, 152, 0.5, 1.0])).to.eq(153);
  });

  it("handles multiple resets", () => {
    expect(sumAccumulated([100, 100.5, 0, 2, 0.25])).to.eq(102.75);
  });

  it("medians odd and even station sets", () => {
    expect(median([1, 2, 3])).to.eq(2);
    expect(median([1, 2, 3, 4])).to.eq(2.5);
    expect(median([])).to.eq(0);
  });
});