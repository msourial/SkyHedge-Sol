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
