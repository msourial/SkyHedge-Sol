import type { IncomingMessage, ServerResponse } from "node:http";

type JsonResponse = ServerResponse & {
  status: (code: number) => JsonResponse;
  json: (body: unknown) => void;
};

const PROGRAM_ID = process.env.SKYHEDGE_PROGRAM_ID ?? "5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx";
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const PROTOCOL_PDA = "3XcAwTUdXJwMA3XhgmfhKBMwYf3JaKwQMFpPigdXskdU";

async function getAccountInfo(address: string): Promise<{ value: null | { executable?: boolean } } | null> {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: address, method: "getAccountInfo", params: [address, { commitment: "finalized", encoding: "base64" }] }),
  });
  if (!response.ok) return null;
  const body = await response.json() as { result?: { value: null | { executable?: boolean } } };
  return body.result ?? null;
}

export default async function handler(_req: IncomingMessage, res: JsonResponse) {
  const started = Date.now();
  let programExecutable = false;
  let protocolInitialized = false;
  try {
    const [programAccount, protocolAccount] = await Promise.all([
      getAccountInfo(PROGRAM_ID),
      getAccountInfo(PROTOCOL_PDA),
    ]);
    programExecutable = Boolean(programAccount?.value?.executable);
    protocolInitialized = Boolean(protocolAccount?.value);
  } catch {
    programExecutable = false;
    protocolInitialized = false;
  }

  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
  return res.status(200).json({
    name: "SkyHedge",
    status: programExecutable ? "ok" : "degraded",
    network: "devnet",
    programId: PROGRAM_ID,
    settlementSource: "NOAA",
    generatedData: false,
    checks: {
      database: { status: "deferred", latencyMs: null, required: false },
      persistence: { status: "optional-deferred", required: false },
      devnet: { status: programExecutable ? "ready" : "degraded", executable: programExecutable },
      protocol: { status: protocolInitialized ? "ready" : "pending", initialized: protocolInitialized },
      settlement: { status: process.env.SETTLEMENT_AUTHORITY_KEYPAIR ? "configured" : "manual-or-missing" },
    },
    responseMs: Date.now() - started,
  });
}
