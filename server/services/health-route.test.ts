import { expect } from "chai";
import { PublicKey } from "@solana/web3.js";
import { createHealthHandler } from "../../api/health";

function responseRecorder() {
  let statusCode = 200;
  let body: unknown;
  const response = {
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { body = value; },
    setHeader() {},
  };
  return { response, result: () => ({ statusCode, body }) };
}

describe("Vercel health endpoint", () => {
  it("derives the protocol PDA from the configured program ID", async () => {
    const programId = PublicKey.unique().toBase58();
    const expectedProgram = new PublicKey(programId);
    const expectedProtocol = PublicKey.findProgramAddressSync([Buffer.from("protocol")], expectedProgram)[0].toBase58();
    const queried: string[] = [];
    const recorder = responseRecorder();
    await createHealthHandler({
      programId,
      rpcUrl: "https://rpc.example",
      settlementConfig: { signerConfigured: true, noaaConfigured: true, cronSecret: "a-secure-cron-secret" },
      getAccountInfo: async (address) => {
        queried.push(address);
        return { value: address === programId ? { executable: true } : {} };
      },
    })({} as never, recorder.response as never);

    expect(queried).to.include(expectedProtocol);
    expect(queried).not.to.include("3XcAwTUdXJwMA3XhgmfhKBMwYf3JaKwQMFpPigdXskdU");
    expect(recorder.result().statusCode).to.equal(200);
    expect((recorder.result().body as { checks: { protocol: { initialized: boolean } } }).checks.protocol.initialized).to.equal(true);
    expect((recorder.result().body as { checks: { settlement: { status: string; cronAuthConfigured: boolean } } }).checks.settlement).to.deep.include({ status: "configured", cronAuthConfigured: true });
  });

  it("returns explicit HTTP 503 RPC-unavailable state instead of false pending values", async () => {
    const recorder = responseRecorder();
    await createHealthHandler({
      programId: PublicKey.unique().toBase58(),
      rpcUrl: "https://rpc.example",
      getAccountInfo: async () => { throw new Error("RPC transport detail"); },
    })({} as never, recorder.response as never);

    expect(recorder.result().statusCode).to.equal(503);
    expect(recorder.result().body).to.deep.equal({
      name: "SkyHedge",
      status: "degraded",
      network: "devnet",
      error: "DEVNET_RPC_UNAVAILABLE",
      message: "Devnet RPC could not be reached; chain readiness is unavailable.",
      checks: { devnet: { status: "unavailable" }, protocol: { status: "unavailable" } },
    });
    expect(JSON.stringify(recorder.result().body)).not.to.contain("RPC transport detail");
  });
});
