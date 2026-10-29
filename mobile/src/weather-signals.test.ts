import assert from "node:assert/strict";
import { it } from "node:test";
import { edgeChip } from "../../shared/weather-signals.ts";
it("shares forecast edge thresholds without importing server weather code", () => {
  assert.equal(edgeChip(24.99, 20), null);
  assert.deepEqual(edgeChip(25, 20), { points: 5, sign: "pos" });
  assert.deepEqual(edgeChip(8, 20), { points: -12, sign: "neg" });
});
