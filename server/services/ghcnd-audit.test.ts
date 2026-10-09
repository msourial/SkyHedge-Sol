import { expect } from "chai";
import { auditGhcndRainfallWindows } from "./ghcnd-audit";

function monthlyLine(station: string, year: number, month: number, values: Array<{ value: number; measurement?: string; quality?: string; source?: string }>) {
  const days = Array.from({ length: 31 }, (_, index) => {
    const day = values[index] ?? { value: -9999 };
    return `${String(day.value).padStart(5, " ")}${day.measurement ?? " "}${day.quality ?? " "}${day.source ?? "C"}`;
  }).join("");
  return `${station}${year}${String(month).padStart(2, "0")}PRCP${days}`;
}

const station = "CAN04057165";
const window = { start: "2025-10-06", endExclusive: "2025-10-11" };

describe("GHCN-Daily station rainfall audit", () => {
  it("accepts only complete, quality-screened daily windows and hashes the actual values", () => {
    const raw = monthlyLine(station, 2025, 10, [
      ...Array.from({ length: 5 }, () => ({ value: -9999 })),
      { value: 0 }, { value: 5 }, { value: 12 }, { value: 0 }, { value: 3 },
    ]);
    const result = auditGhcndRainfallWindows(raw, station, [window]);
    expect(result.totalsMm).to.deep.equal([2]);
    expect(result.records).to.have.length(5);
    expect(result.records[0]).to.include({ date: "2025-10-06", sourceFlag: "C" });
    expect(result.sourceHash).to.match(/^[a-f0-9]{64}$/);
    expect(auditGhcndRainfallWindows(raw.replace("   12  C", "   13  C"), station, [window]).sourceHash).to.not.equal(result.sourceHash);
  });

  it("rejects absent, missing-value, trace, and quality-flagged days", () => {
    const values = [...Array.from({ length: 5 }, () => ({ value: -9999 })), ...Array.from({ length: 5 }, () => ({ value: 0 }))];
    const valid = monthlyLine(station, 2025, 10, values);
    expect(() => auditGhcndRainfallWindows("", station, [window])).to.throw(/missing/i);
    expect(() => auditGhcndRainfallWindows(monthlyLine(station, 2025, 10, values.map((day, index) => index === 7 ? { value: -9999 } : day)), station, [window])).to.throw(/missing/i);
    expect(() => auditGhcndRainfallWindows(monthlyLine(station, 2025, 10, values.map((day, index) => index === 7 ? { value: 0, measurement: "T" } : day)), station, [window])).to.throw(/measurement/i);
    expect(() => auditGhcndRainfallWindows(monthlyLine(station, 2025, 10, values.map((day, index) => index === 7 ? { value: 0, quality: "X" } : day)), station, [window])).to.throw(/quality/i);
    expect(() => auditGhcndRainfallWindows(valid, "CAN04057120", [window])).to.throw(/missing/i);
  });

  it("requires exactly ten complete analogous windows when requested", () => {
    const raw = monthlyLine(station, 2025, 10, Array.from({ length: 10 }, () => ({ value: 0 })));
    expect(() => auditGhcndRainfallWindows(raw, station, Array.from({ length: 10 }, (_, index) => ({ start: `${2016 + index}-10-06`, endExclusive: `${2016 + index}-10-11` })))).to.throw(/missing/i);
    expect(() => auditGhcndRainfallWindows(raw, station, [])).to.throw(/window/i);
  });
});
