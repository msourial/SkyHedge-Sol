import type { IncomingMessage, ServerResponse } from "node:http";
import { PublicKey } from "@solana/web3.js";
import { settlementWorkerReadiness, type SettlementWorkerConfig } from "../server/services/settlement-config.js";

type JsonResponse = ServerResponse & {
  status: (code: number) => JsonResponse;
  json: (body: unknown) => void;
};

const PROGRAM_ID = process.env.SKYHEDGE_PROGRAM_ID ?? "5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx";
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
type RpcAccount = { value: null | { executable?: boolean } };
type HealthOptions = {
  programId?: string;
  rpcUrl?: string;
  getAccountInfo?: (address: string, rpcUrl: string) => Promise<RpcAccount>;
  settlementConfig?: SettlementWorkerConfig;
};

async function getAccountInfo(address: string, rpcUrl: string): Promise<RpcAccount> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: address, method: "getAccountInfo", params: [address, { commitment: "finalized", encoding: "base64" }] }),
  });
  if (!response.ok) throw new Error("Solana RPC request failed.");
  const body = await response.json() as { result?: RpcAccount; error?: unknown };
  if (body.error || !body.result) throw new Error("Solana RPC returned an invalid response.");
  return body.result;
}

export function createHealthHandler(options: HealthOptions = {}) {
  const programId = new PublicKey(options.programId ?? PROGRAM_ID);
  const rpcUrl = options.rpcUrl ?? RPC_URL;
  const [protocolAddress] = PublicKey.findProgramAddressSync([Buffer.from("protocol")], programId);
  const readAccount = options.getAccountInfo ?? getAccountInfo;

  return async function healthHandler(_req: IncomingMessage, res: JsonResponse) {
    const started = Date.now();
    const settlement = settlementWorkerReadiness(options.settlementConfig ?? {
      signerConfigured: Boolean(process.env.SETTLEMENT_AUTHORITY_KEYPAIR),
      noaaConfigured: Boolean(process.env.NOAA_TOKEN),
      cronSecret: process.env.CRON_SECRET,
    });
    let programAccount: RpcAccount;
    let protocolAccount: RpcAccount;
    try {
      [programAccount, protocolAccount] = await Promise.all([
        readAccount(programId.toBase58(), rpcUrl),
        readAccount(protocolAddress.toBase58(), rpcUrl),
      ]);
    } catch {
      res.setHeader("Cache-Control", "no-store");
      return res.status(503).json({
        name: "SkyHedge",
        status: "degraded",
        network: process.env.SOLANA_NETWORK ?? "devnet",
        error: "DEVNET_RPC_UNAVAILABLE",
        message: "Devnet RPC could not be reached; chain readiness is unavailable.",
        checks: { devnet: { status: "unavailable" }, protocol: { status: "unavailable" } },
      });
    }

    const programExecutable = Boolean(programAccount.value?.executable);
    const protocolInitialized = Boolean(protocolAccount.value);
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json({
      name: "SkyHedge",
      status: programExecutable ? "ok" : "degraded",
      network: process.env.SOLANA_NETWORK ?? "devnet",
      programId: programId.toBase58(),
      settlementSource: "NOAA",
      generatedData: false,
      checks: {
        database: { status: "deferred", latencyMs: null, required: false },
        persistence: { status: "optional-deferred", required: false },
        devnet: { status: programExecutable ? "ready" : "degraded", executable: programExecutable },
        protocol: { status: protocolInitialized ? "ready" : "pending", initialized: protocolInitialized },
        settlement,
      },
      responseMs: Date.now() - started,
    });
  };
}

export default createHealthHandler();
