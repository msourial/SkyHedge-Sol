import { expect } from "chai";
import { createDevnetStatusHandler } from "../../api/devnet/status";

function responseRecorder() {
  let statusCode = 200;
  let body: unknown;
  const headers = new Map<string, string>();
  const response = {
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { body = value; return this; },
    setHeader(name: string, value: string) { headers.set(name, value); },
  };
  return { response, result: () => ({ statusCode, body, headers }) };
}

describe("deployed Devnet status endpoint", () => {
  it("returns the live reader result without leaking its RPC URL", async () => {
    const liveStatus = {
      network: "devnet",
      rpcUrl: "https://private-rpc.example/key",
      program: { status: "ready" },
      protocol: { status: "ready", nextMarketId: "0" },
      desMoinesMarket: { status: "pending" },
      noaaEvidence: { status: "ready", settlementSource: "NOAA" },
    };
    const recorder = responseRecorder();
    await createDevnetStatusHandler(async () => liveStatus)({} as never, recorder.response as never);

    expect(recorder.result().statusCode).to.equal(200);
    expect(recorder.result().body).to.deep.equal({
      network: "devnet",
      program: { status: "ready" },
      protocol: { status: "ready", nextMarketId: "0" },
      desMoinesMarket: { status: "pending" },
      noaaEvidence: { status: "ready", settlementSource: "NOAA" },
    });
    expect(recorder.result().headers.get("Cache-Control")).to.equal("s-maxage=30, stale-while-revalidate=60");
  });

  it("reports live RPC failures as unavailable instead of returning stale readiness", async () => {
    const recorder = responseRecorder();
    await createDevnetStatusHandler(async () => { throw new Error("Devnet RPC offline"); })({} as never, recorder.response as never);

    expect(recorder.result().statusCode).to.equal(503);
    expect(recorder.result().body).to.deep.equal({ error: "DEVNET_STATUS_UNAVAILABLE", message: "Devnet RPC offline" });
  });
});
