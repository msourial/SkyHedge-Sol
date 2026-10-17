import { expect } from "chai";
import { createWindowEvidenceHandler } from "../../api/window-evidence";
import { openLadder } from "../../shared/window-ladder";
import { clearWindowEvidenceMemory, ensureCityWindowEvidence, memoryWindowEvidence } from "./window-evidence";

const NOW = Date.parse("2026-10-17T15:00:00Z") / 1000;

describe("window evidence packages", () => {
  it("keeps a validated NOAA package for every open rung, not only the first", async () => {
    clearWindowEvidenceMemory();
    const seen: string[] = [];
    const engine = {
      analogueTotals: async (request: { observationStart: string; observationEnd: string }) => {
        seen.push(`${request.observationStart}:${request.observationEnd}`);
        return [1, 2, 3, 4, 5, 6, 7, 8, 12, 40];
      },
      forecastCumulativeOrNull: async () => null,
    };
    const first = await ensureCityWindowEvidence("new-york", NOW, engine as never);
    const again = await ensureCityWindowEvidence("chicago", NOW, engine as never);
    const repeat = await ensureCityWindowEvidence("new-york", NOW, engine as never);
    expect(first.unavailable).to.deep.equal([]);
    expect(first.packages).to.have.length(openLadder(NOW).length);
    expect(new Set(first.packages.map((pkg) => pkg.observationStart)).size).to.equal(4);
    expect(again.packages).to.have.length(4);
    expect(repeat.packages).to.have.length(4);
    expect(seen).to.have.length(8);
    expect(memoryWindowEvidence().map((pkg) => `${pkg.city}:${pkg.observationStart}`)).to.have.length(8);
    clearWindowEvidenceMemory();
  });

  it("rejects a city that is not on the live ladder before reading NOAA", async () => {
    let called = false;
    const handler = createWindowEvidenceHandler(async () => { called = true; return { packages: [], unavailable: [] }; });
    let status = 0;
    const response = { status(code: number) { status = code; return this; }, json() {}, setHeader() {} };
    await handler({ method: "GET", url: "/api/window-evidence?city=toronto" } as never, response as never);
    expect(status).to.equal(400);
    expect(called).to.equal(false);
  });
});
