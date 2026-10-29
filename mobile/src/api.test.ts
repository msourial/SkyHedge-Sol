import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { claimReadinessPath, isNonJsonReply, postJson } from "./api.ts";

describe("mobile API replies", () => {
  it("treats an HTML reply as not available yet", () => {
    assert.equal(isNonJsonReply("text/html; charset=utf-8", "<!doctype html>"), true);
    assert.equal(isNonJsonReply(null, "  <html>"), true);
    assert.equal(isNonJsonReply("application/json", "{\"state\":\"open\"}"), false);
  });
  it("reads claim readiness through the combined mobile endpoint", () => {
    assert.equal(claimReadinessPath("M1", "W 2"), "/api/mobile?resource=claim-readiness&market=M1&wallet=W%202");
  });

  it("aborts a hung POST after the timeout and retries once", async () => {
    let calls = 0;
    const fetcher: typeof fetch = async (_url, init) => {
      calls += 1;
      if (calls === 1) {
        await new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) { reject(new Error("missing AbortSignal")); return; }
          signal.addEventListener("abort", () => reject(new DOMException("The operation was aborted.", "AbortError")), { once: true });
        });
      }
      return new Response(JSON.stringify({ premium: "24000000" }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const body = await postJson<{ premium: string }>("/api/quotes", { protectedAmount: "100000000" }, { timeoutMs: 40, attempts: 2, fetcher });
    assert.equal(calls, 2);
    assert.equal(body.premium, "24000000");
  });
});

// Signals are loaded on demand through the same deployed mobile API.
describe("weather signal client", () => {
  it("encodes batches, removes duplicates, and caps requests at twenty", async () => {
    const { weatherSignalsPath } = await import("./api.ts");
    assert.equal(weatherSignalsPath("cover-progress", ["M1", "M2", "M1"]), "/api/mobile?resource=cover-progress&markets=M1%2CM2");
    assert.equal(weatherSignalsPath("forecast-edge", ["M1"]), "/api/mobile?resource=forecast-edge&markets=M1");
    assert.throws(() => weatherSignalsPath("cover-progress", []));
    assert.throws(() => weatherSignalsPath("cover-progress", Array.from({ length: 21 }, (_, i) => String(i))));
  });
  it("loads both weather signals without replacing missing observations or forecast nulls", async () => {
    const { getCoverProgress, getForecastEdge } = await import("./api.ts");
    const saved = globalThis.fetch;
    const paths: string[] = [];
    globalThis.fetch = async (url) => {
      paths.push(String(url));
      return new Response(JSON.stringify(String(url).includes("cover-progress") ? { progress: { M1: { valueNative: null, state: "unavailable" } } } : { edges: { M1: { forecast: null, historyProbability: 0.2 } } }), { headers: { "Content-Type": "application/json" } });
    };
    try {
      assert.equal((await getCoverProgress(["M1"])).progress.M1?.valueNative, null);
      assert.deepEqual((await getForecastEdge(["M1"])).edges.M1, { forecast: null, historyProbability: 0.2 });
      assert.ok(paths[0].includes("resource=cover-progress"));
      assert.ok(paths[1].includes("resource=forecast-edge"));
    } finally { globalThis.fetch = saved; }
  });
});
