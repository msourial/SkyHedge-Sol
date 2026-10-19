import { expect } from "chai";
import { callWithRpcFailover } from "./rpc-failover";

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
});
