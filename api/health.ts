import type { IncomingMessage, ServerResponse } from "node:http";
import { PublicKey } from "@solana/web3.js";
import { settlementWorkerReadiness, type SettlementWorkerConfig } from "../server/services/settlement-config.js";
import { applyCorsHeaders } from "../server/services/cors.js";
import { isRpcRateLimited, rpcRateLimitedBody } from "../server/services/rpc-failover.js";

type JsonResponse = ServerResponse & {
  status: (code: number) => JsonResponse;
  json: (body: unknown) => void;
};

const PROGRAM_ID = process.env.SKYHEDGE_PROGRAM_ID ?? "5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx";
type RpcAccount = { value: null | { executable?: boolean } };
type HealthOptions = {
  programId?: string;
  rpcUrl?: string;
  getAccountInfo?: (address: string, rpcUrl: string) => Promise<RpcAccount>;
  getMultipleAccounts?: (addresses: string[], rpcUrl: string) => Promise<RpcAccount[]>;
  settlementConfig?: SettlementWorkerConfig;
};

function throwIfRateLimited(status: number, body: { error?: unknown }): void {
  if (status === 429 || isRpcRateLimited(body.error)) {
    const error = new Error("429 Too Many Requests");
    (error as Error & { status: number }).status = 429;
    throw error;
  }
}

/** One getMultipleAccounts covers program + protocol instead of two getAccountInfo calls. */
async function getMultipleAccounts(addresses: string[], rpcUrl: string): Promise<RpcAccount[]> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getMultipleAccounts",
      params: [addresses, { commitment: "finalized", encoding: "base64" }],
    }),
  });
  const body = await response.json().catch(() => ({})) as { result?: { value?: Array<null | { executable?: boolean }> }; error?: unknown };
  throwIfRateLimited(response.status, body);
  if (!response.ok) throw new Error("Solana RPC request failed.");
  const values = body.result?.value;
  if (body.error || !Array.isArray(values) || values.length !== addresses.length) {
    throw new Error("Solana RPC returned an invalid response.");
  }
  return values.map((value) => ({ value }));
}

export function createHealthHandler(options: HealthOptions = {}) {
  const programId = new PublicKey(options.programId ?? PROGRAM_ID);
  const [protocolAddress] = PublicKey.findProgramAddressSync([Buffer.from("protocol")], programId);

  async function readAccounts(rpcUrl: string): Promise<[RpcAccount, RpcAccount]> {
    const addresses = [programId.toBase58(), protocolAddress.toBase58()];
    if (options.getMultipleAccounts) {
      const accounts = await options.getMultipleAccounts(addresses, rpcUrl);
      return [accounts[0]!, accounts[1]!];
    }
    if (options.getAccountInfo) {
      return Promise.all([
        options.getAccountInfo(addresses[0]!, rpcUrl),
        options.getAccountInfo(addresses[1]!, rpcUrl),
      ]);
    }
    const accounts = await getMultipleAccounts(addresses, rpcUrl);
    return [accounts[0]!, accounts[1]!];
  }

  return async function healthHandler(req: IncomingMessage, res: JsonResponse) {
    applyCorsHeaders(req, res);
    const started = Date.now();
    const rpcUrl = options.rpcUrl ?? process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
    const settlement = settlementWorkerReadiness(options.settlementConfig ?? {
      signerConfigured: Boolean(process.env.SETTLEMENT_AUTHORITY_KEYPAIR),
      noaaConfigured: Boolean(process.env.NOAA_TOKEN),
      cronSecret: process.env.CRON_SECRET,
    });
    let programAccount: RpcAccount;
    let protocolAccount: RpcAccount;
    try {
      [programAccount, protocolAccount] = await readAccounts(rpcUrl);
    } catch (error) {
      res.setHeader("Cache-Control", "no-store");
      if (isRpcRateLimited(error)) {
        return res.status(429).json({
          name: "SkyHedge",
          status: "degraded",
          network: process.env.SOLANA_NETWORK ?? "devnet",
          ...rpcRateLimitedBody(),
          checks: { devnet: { status: "unavailable" }, protocol: { status: "unavailable" } },
        });
      }
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
    res.setHeader("Cache-Control", "s-maxage=45, stale-while-revalidate=60");
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
