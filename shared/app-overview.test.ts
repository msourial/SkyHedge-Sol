import assert from "node:assert/strict";
import { test } from "node:test";
import { formatSkytBase, overviewMetricsFromStatus } from "./app-overview.ts";

test("formatSkytBase groups whole SKYT", () => {
  assert.equal(formatSkytBase(2_000_000_000n), "2,000");
  assert.equal(formatSkytBase(2_024_000_000n), "2,024");
  assert.equal(formatSkytBase(40145150000n), "40,145.15");
});

test("overview metrics from ladder markets; omits cover/premiums/settlements", () => {
  const result = overviewMetricsFromStatus({
    ladderMarkets: [
      { city: "new-york", state: "open", vaultBalance: "2024000000" },
      { city: "chicago", state: "open", vaultBalance: "2000000000" },
      { city: "des-moines", state: "cancelled", vaultBalance: "0" },
      { city: "new-york", state: "open", vaultBalance: "2000000000" },
    ],
  });
  assert.deepEqual(
    result.metrics.map((m) => m.id),
    ["openMarkets", "cities", "vaultCollateral"],
  );
  assert.equal(result.metrics.find((m) => m.id === "openMarkets")?.value, "3");
  assert.equal(result.metrics.find((m) => m.id === "cities")?.value, "2");
  assert.equal(result.metrics.find((m) => m.id === "vaultCollateral")?.value, "6,024");
  assert.ok(result.omitted.includes("coverSold"));
  assert.ok(result.omitted.includes("premiums"));
  assert.ok(result.omitted.includes("recentSettlements"));
});

test("falls back to selling cityWindows without inventing vault", () => {
  const now = 1_700_000_000;
  const result = overviewMetricsFromStatus({
    cityWindows: [
      { city: "miami", salesCloseAt: now + 100 },
      { city: "miami", salesCloseAt: now + 200 },
      { city: "boston", salesCloseAt: now - 10 },
    ],
  }, now);
  assert.equal(result.metrics.find((m) => m.id === "openMarkets")?.value, "2");
  assert.equal(result.metrics.find((m) => m.id === "cities")?.value, "1");
  assert.ok(result.omitted.includes("vaultCollateral"));
  assert.ok(!result.metrics.some((m) => m.id === "vaultCollateral"));
});

test("empty status omits live metrics", () => {
  const result = overviewMetricsFromStatus(null);
  assert.equal(result.metrics.length, 0);
  assert.ok(result.omitted.includes("openMarkets"));
  assert.ok(result.omitted.includes("cities"));
  assert.ok(result.omitted.includes("vaultCollateral"));
});
