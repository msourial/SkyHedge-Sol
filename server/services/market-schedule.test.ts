import { expect } from "chai";
import { desMoinesSeedSchedule } from "../../shared/market-schedule";

describe("Des Moines Devnet market schedule", () => {
  it("closes sales after exactly 24 hours and uses five complete UTC observation days", () => {
    expect(desMoinesSeedSchedule(Date.parse("2026-09-21T07:15:00.000Z"))).to.deep.equal({
      salesCloseAt: Date.parse("2026-09-22T07:15:00.000Z") / 1_000,
      observationStart: Date.parse("2026-09-23T00:00:00.000Z") / 1_000,
      observationEnd: Date.parse("2026-09-28T00:00:00.000Z") / 1_000,
    });
  });

  it("keeps the immutable observation window to five complete UTC days after the 24-hour sale", () => {
    for (const now of [
      Date.parse("2026-09-27T00:00:01.000Z"),
      Date.parse("2026-09-27T10:00:00.000Z"),
      Date.parse("2026-09-27T23:59:59.000Z"),
    ]) {
      const schedule = desMoinesSeedSchedule(now);
      expect((schedule.observationEnd - schedule.observationStart) / 86_400).to.equal(5);
      expect(schedule.observationStart % 86_400).to.equal(0);
      expect(schedule.salesCloseAt - Math.floor(now / 1_000)).to.equal(86_400);
    }
  });
});
