import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchWithRetry } from "./api.ts";
import { readFinalizedWalletStateAnyRpc } from "./chain.ts";

describe("network resilience", () => {
  it("retries a DNS failure and succeeds", async () => {
    let n = 0;
    const fetcher = (async () => { n++; if (n < 2) throw new Error("java.net.UnknownHostException: Unable to resolve host"); return new Response("{}"); }) as typeof fetch;
    const r = await fetchWithRetry("https://x", {}, { fetcher, delayMs: 1 });
    assert.equal(r.status, 200); assert.equal(n, 2);
  });
  it("gives up after the attempt budget", async () => {
    const fetcher = (async () => { throw new Error("offline"); }) as typeof fetch;
    await assert.rejects(fetchWithRetry("https://x", {}, { fetcher, attempts: 2, delayMs: 1 }), /offline/);
  });
  it("falls through to the next direct RPC without touching the SkyHedge host", async () => {
    const seen: string[] = [];
    const state = await readFinalizedWalletStateAnyRpc("w", { urls: ["a", "b"], read: async (_w, url) => { seen.push(url); if (url === "a") throw new Error("down"); return { sol: 1, skytBaseUnits: "5", skytDecimals: 6, slot: 1 }; } });
    assert.deepEqual(seen, ["a", "b"]); assert.equal(state.skytBaseUnits, "5");
  });
});
