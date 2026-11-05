import assert from "node:assert/strict";
import { test } from "node:test";
import { readReadiness, watchReadiness } from "./readiness-refresh.ts";
test("refreshes on bounded intervals and visible focus; cleans up listeners", async t => {
  t.mock.timers.enable({ apis: ["Date", "setInterval"], now: 0 });
  const win = new EventTarget(), doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  let reads = 0;
  const stop = watchReadiness(async () => { reads++; }, { window: win, document: doc } as any);
  const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
  await flush();
  assert.equal(reads, 1);
  win.dispatchEvent(new Event("focus")); doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(reads, 1);
  t.mock.timers.tick(60_000); await flush(); assert.equal(reads, 2);
  doc.visibilityState = "hidden";
  t.mock.timers.tick(120_000); await flush(); assert.equal(reads, 2);
  doc.visibilityState = "visible";
  doc.dispatchEvent(new Event("visibilitychange")); await flush(); assert.equal(reads, 3);
  stop(); t.mock.timers.tick(120_000); win.dispatchEvent(new Event("focus")); assert.equal(reads, 3);
});
test("slow and failed reads never overlap or cause a retry storm", async t => {
  t.mock.timers.enable({ apis: ["Date", "setInterval"], now: 0 });
  const win = new EventTarget(), doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  let reads = 0, reject!: (e: Error) => void;
  const stop = watchReadiness(() => { reads++; return new Promise<void>((_, r) => { reject = r; }); }, { window: win, document: doc } as any);
  t.mock.timers.tick(180_000); win.dispatchEvent(new Event("focus")); assert.equal(reads, 1);
  reject(new Error("unavailable"));
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  t.mock.timers.tick(60_000); assert.equal(reads, 2);
  stop(); reject(new Error("unavailable")); await Promise.resolve();
});

test("read failures replace readiness with unknown and duplicate markets read once", async () => {
  let reads = 0;
  const ready = await readReadiness(["market", "market"], async () => { reads++; return { state: "claimable", action: "claim_premium_refund" }; });
  assert.equal(reads, 1);
  assert.equal(ready.market?.action, "claim_premium_refund");
  const failed = await readReadiness(["market"], async () => { throw new Error("offline"); });
  assert.deepEqual(failed, { market: null });
});
