import { expect } from "chai";
import { callWithRpcFailover, RPC_ATTEMPT_TIMEOUT_MS, RPC_FAILOVER_DEADLINE_MS, RPC_PRIMARY_ATTEMPT_TIMEOUT_MS } from "./rpc-failover";

const primary = "https://api.devnet.solana.com";
const fallback = "https://solana-devnet.api.onfinality.io/public";

describe("Devnet RPC failover", () => {
  it("retries a 429 on the first endpoint with backoff and does not call the fallback", async () => {
    const calls: string[] = [];
    const sleeps: number[] = [];
    let tries = 0;
    const result = await callWithRpcFailover(
      [primary, fallback],
      async (url) => {
        calls.push(url);
        tries += 1;
        if (tries === 1) throw new Error("429 Too Many Requests");
        return "status";
      },
      {
        backoffMs: [10, 20],
        timeoutMs: 1_000,
        sleep: async (ms) => { sleeps.push(ms); },
      },
    );
    expect(result).to.equal("status");
    expect(calls).to.deep.equal([primary, primary]);
    expect(sleeps).to.deep.equal([10]);
  });

  it("uses the fallback RPC after 429 retries are exhausted", async () => {
    const calls: string[] = [];
    const sleeps: number[] = [];
    const result = await callWithRpcFailover(
      [primary, fallback],
      async (url) => {
        calls.push(url);
        if (url === primary) throw new Error("Server responded with 429");
        return "from-fallback";
      },
      {
        backoffMs: [10, 20],
        timeoutMs: 1_000,
        sleep: async (ms) => { sleeps.push(ms); },
      },
    );
    expect(result).to.equal("from-fallback");
    expect(calls).to.deep.equal([primary, primary, primary, fallback]);
    expect(sleeps).to.deep.equal([10, 20]);
  });

  it("stops a hung endpoint at the timeout and tries the fallback without backoff", async () => {
    const calls: string[] = [];
    const sleeps: number[] = [];
    const result = await callWithRpcFailover(
      [primary, fallback],
      async (url) => {
        calls.push(url);
        if (url === primary) return new Promise(() => {});
        return "from-fallback";
      },
      {
        backoffMs: [500],
        primaryTimeoutMs: 30,
        timeoutMs: 30,
        sleep: async (ms) => { sleeps.push(ms); },
      },
    );
    expect(result).to.equal("from-fallback");
    expect(calls).to.deep.equal([primary, fallback]);
    expect(sleeps).to.deep.equal([]);
  });

  it("throws when the primary stays rate-limited and the fallback is rate-limited too", async () => {
    const calls: string[] = [];
    let message = "";
    try {
      await callWithRpcFailover(
        [primary, fallback],
        async (url) => {
          calls.push(url);
          throw new Error(`429 Too Many Requests from ${url}`);
        },
        {
          backoffMs: [5],
          timeoutMs: 1_000,
          sleep: async () => {},
        },
      );
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }
    expect(message).to.include("429");
    expect(message).to.include(fallback);
    expect(calls).to.deep.equal([primary, primary, fallback]);
  });

  it("does not start another attempt after the deadline", async () => {
    let clock = 0;
    const calls: string[] = [];
    let message = "";
    try {
      await callWithRpcFailover(
        [primary, fallback],
        async (url) => {
          calls.push(url);
          clock += 40;
          throw new Error("429 Too Many Requests");
        },
        {
          backoffMs: [30, 30],
          deadlineMs: 50,
          timeoutMs: 1_000,
          now: () => clock,
          sleep: async (ms) => { clock += ms; },
        },
      );
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }
    expect(message).to.include("429");
    expect(calls).to.deep.equal([primary]);
  });

  it("gives a slow primary its longer budget instead of failing over at the fallback timeout", async () => {
    const calls: string[] = [];
    const result = await callWithRpcFailover(
      [primary, fallback],
      async (url) => {
        calls.push(url);
        if (url === primary) return new Promise<string>((resolve) => setTimeout(() => resolve("from-primary"), 60));
        return "from-fallback";
      },
      { primaryTimeoutMs: 200, timeoutMs: 20, backoffMs: [], sleep: async () => {} },
    );
    expect(result).to.equal("from-primary");
    expect(calls).to.deep.equal([primary]);
  });

  it("keeps fallbacks on the short budget", async () => {
    const calls: string[] = [];
    let message = "";
    const started = Date.now();
    try {
      await callWithRpcFailover(
        [primary, fallback],
        async (url) => {
          calls.push(url);
          if (url === primary) throw new Error("boom");
          return new Promise<string>((resolve) => setTimeout(() => resolve("late"), 500));
        },
        { primaryTimeoutMs: 1_000, timeoutMs: 30, backoffMs: [], sleep: async () => {} },
      );
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }
    expect(message).to.include("timed out");
    expect(calls).to.deep.equal([primary, fallback]);
    expect(Date.now() - started).to.be.lessThan(400);
  });

  it("defaults: primary 8s, fallbacks 3s, deadline fits primary plus two fallbacks", () => {
    expect(RPC_PRIMARY_ATTEMPT_TIMEOUT_MS).to.equal(8_000);
    expect(RPC_ATTEMPT_TIMEOUT_MS).to.equal(3_000);
    expect(RPC_FAILOVER_DEADLINE_MS).to.be.at.least(RPC_PRIMARY_ATTEMPT_TIMEOUT_MS + 2 * RPC_ATTEMPT_TIMEOUT_MS);
  });
});
