import { expect } from "chai";
import { Keypair } from "@solana/web3.js";
import { createSettlementCronHandler } from "../../api/cron/settlement";
import { loadSettlementKeypair } from "./settlement";

function responseRecorder() {
  let statusCode = 200;
  let body: unknown;
  const response = {
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { body = value; return this; },
    setHeader(_name: string, _value: string) {},
  };
  return { response, result: () => ({ statusCode, body }) };
}

describe("Vercel NOAA settlement cron", () => {
  const request = (authorization?: string, method = "GET") => ({ method, headers: { authorization } }) as never;
  const ready = { cronSecret: "a-random-cron-secret-at-least-16", signerConfigured: true, noaaConfigured: true };

  it("does not run when the cron secret is absent", async () => {
    const recorder = responseRecorder();
    await createSettlementCronHandler({ config: { ...ready, cronSecret: undefined }, runOnce: async () => { throw new Error("must not run"); } })(request(), recorder.response as never);
    expect(recorder.result()).to.deep.equal({ statusCode: 503, body: { error: "SETTLEMENT_CRON_UNCONFIGURED" } });
  });

  it("rejects unauthenticated calls without invoking the settlement worker", async () => {
    const recorder = responseRecorder();
    await createSettlementCronHandler({ config: ready, runOnce: async () => { throw new Error("must not run"); } })(request("Bearer wrong-secret"), recorder.response as never);
    expect(recorder.result()).to.deep.equal({ statusCode: 401, body: { error: "UNAUTHORIZED" } });
  });

  it("requires both the settlement signer and NOAA credentials", async () => {
    const recorder = responseRecorder();
    await createSettlementCronHandler({ config: { ...ready, signerConfigured: false }, runOnce: async () => { throw new Error("must not run"); } })(request(`Bearer ${ready.cronSecret}`), recorder.response as never);
    expect(recorder.result()).to.deep.equal({ statusCode: 503, body: { error: "SETTLEMENT_WORKER_UNCONFIGURED" } });
  });

  it("runs once for an authenticated scheduled request and returns its finalized actions", async () => {
    const recorder = responseRecorder();
    const run = { scanned: 1, advanced: [], settled: ["Market111"], markedUnavailable: [], pending: [] };
    await createSettlementCronHandler({ config: ready, runOnce: async () => run })(request(`Bearer ${ready.cronSecret}`), recorder.response as never);
    expect(recorder.result()).to.deep.equal({ statusCode: 200, body: { ok: true, result: run } });
  });

  it("only accepts GET and hides worker errors while leaving the scheduled retry safe", async () => {
    const methodResponse = responseRecorder();
    await createSettlementCronHandler({ config: ready, runOnce: async () => { throw new Error("must not run"); } })(request(`Bearer ${ready.cronSecret}`, "POST"), methodResponse.response as never);
    expect(methodResponse.result()).to.deep.equal({ statusCode: 405, body: { error: "METHOD_NOT_ALLOWED" } });

    const errorResponse = responseRecorder();
    await createSettlementCronHandler({ config: ready, runOnce: async () => { throw new Error("private RPC credential must not leak"); } })(request(`Bearer ${ready.cronSecret}`), errorResponse.response as never);
    expect(errorResponse.result()).to.deep.equal({ statusCode: 500, body: { error: "SETTLEMENT_RUN_FAILED", message: "Settlement check failed; the next scheduled run will retry." } });
    expect(JSON.stringify(errorResponse.result().body)).not.to.contain("private RPC credential");
  });

  it("loads a server-side JSON secret key without requiring a key file", () => {
    const expected = Keypair.generate();
    const actual = loadSettlementKeypair(JSON.stringify(Array.from(expected.secretKey)));
    expect(actual.publicKey.toBase58()).to.equal(expected.publicKey.toBase58());
  });
});
