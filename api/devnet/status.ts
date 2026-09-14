import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash } from "node:crypto";

type JsonResponse = ServerResponse & {
  status: (code: number) => JsonResponse;
  json: (body: unknown) => void;
};

const PROGRAM_ID = process.env.SKYHEDGE_PROGRAM_ID ?? "5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx";
const SKYT_MINT = process.env.SKYT_MINT ?? "3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g";
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const PROTOCOL_PDA = "3XcAwTUdXJwMA3XhgmfhKBMwYf3JaKwQMFpPigdXskdU";
// PDA derived from ["fee-vault", protocol PDA] for the deployed program.
// Keep this aligned with server/services/devnet-status.ts and the Anchor seeds.
const FEE_VAULT = "HR1UDnVYsBfFxqcyydfkL9zdym3VJ8ZtHRkXbD7iJquu";

async function rpc<T>(method: string, params: unknown[]): Promise<T | null> {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: method, method, params }),
  });
  if (!response.ok) throw new Error(`Solana RPC ${method} failed (${response.status})`);
  const body = await response.json() as { result?: T; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message ?? `Solana RPC ${method} returned an error`);
  return body.result ?? null;
}

type RpcAccountInfo = { value: null | { executable?: boolean; data?: { parsed?: { info?: Record<string, unknown> } } } };
type RpcTokenBalance = { value: { amount: string; decimals: number; uiAmountString?: string } };

async function readDevnetStatus() {
  const targetCityHash = createHash("sha256").update("des-moines").digest("hex");

  const [programAccount, protocolAccount, feeVaultBalance, mintAccount, mintSupply] = await Promise.all([
    rpc<RpcAccountInfo>("getAccountInfo", [PROGRAM_ID, { commitment: "finalized", encoding: "base64" }]),
    rpc<RpcAccountInfo>("getAccountInfo", [PROTOCOL_PDA, { commitment: "finalized", encoding: "base64" }]),
    rpc<RpcTokenBalance>("getTokenAccountBalance", [FEE_VAULT, { commitment: "finalized" }]).catch(() => null),
    rpc<RpcAccountInfo>("getAccountInfo", [SKYT_MINT, { commitment: "finalized", encoding: "jsonParsed" }]).catch(() => null),
    rpc<RpcTokenBalance>("getTokenSupply", [SKYT_MINT, { commitment: "finalized" }]).catch(() => null),
  ]);
  const mintInfo = mintAccount?.value?.data?.parsed?.info ?? null;
  const mintAuthority = typeof mintInfo?.mintAuthority === "string" ? mintInfo.mintAuthority : null;

  return {
    generatedAt: new Date().toISOString(),
    cluster: "devnet" as const,
    program: {
      address: PROGRAM_ID,
      status: programAccount?.value?.executable ? "ready" : "pending",
      executable: Boolean(programAccount?.value?.executable),
      explorerUrl: `https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`,
    },
    idl: { status: "ready", source: "local-committed-idl", instructionCount: 21, accountCount: 5 },
    protocol: {
      address: PROTOCOL_PDA,
      status: protocolAccount?.value ? "ready" : "pending",
      initialized: Boolean(protocolAccount?.value),
      admin: null,
      settlementAuthority: null,
      collateralMint: null,
      nextMarketId: null,
    },
    feeVault: {
      address: FEE_VAULT,
      status: feeVaultBalance ? "ready" : "pending",
      balance: feeVaultBalance?.value.amount ?? null,
    },
    skytMint: {
      address: SKYT_MINT,
      status: mintAccount?.value ? "ready" : "pending",
      exists: Boolean(mintAccount?.value),
      decimals: mintSupply?.value.decimals ?? null,
      supply: mintSupply?.value.amount ?? null,
      mintAuthority,
    },
    desMoinesMarket: {
      status: "pending",
      address: null,
      marketId: null,
      vault: null,
      vaultBalance: null,
      onchainStatus: null,
      evidenceStatus: "researching_evidence",
      targetCityHash,
    },
    noaaEvidence: {
      status: "researching_evidence",
      settlementSource: "NOAA",
      message: "Des Moines remains gated until its final NOAA station and evidence package are pinned.",
    },
  };
}

export default async function handler(_req: IncomingMessage, res: JsonResponse) {
  try {
    const status = await readDevnetStatus();
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Devnet status unavailable";
    return res.status(503).json({ error: "DEVNET_STATUS_UNAVAILABLE", message });
  }
}
