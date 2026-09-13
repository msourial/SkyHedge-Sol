import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { BorshCoder, type Idl } from "@coral-xyz/anchor";
import { getMint } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";

const PROGRAM_ID = process.env.SKYHEDGE_PROGRAM_ID ?? "5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx";
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const SKYT_MINT = process.env.SKYT_MINT ?? "3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g";

type Status = "ready" | "pending" | "unavailable" | "error";

export interface DevnetStatus {
  network: string;
  rpcUrl: string;
  program: { address: string; status: Status; executable: boolean; explorerUrl: string };
  idl: { status: Status; source: "local-committed-idl"; instructionCount: number; accountCount: number };
  protocol: { address: string; status: Status; initialized: boolean; admin: string | null; settlementAuthority: string | null; collateralMint: string | null; nextMarketId: string | null };
  feeVault: { address: string; status: Status; exists: boolean; balance: string | null };
  skytMint: { address: string; status: Status; exists: boolean; decimals: number | null; supply: string | null; mintAuthority: string | null };
  desMoinesMarket: { status: Status; address: string | null; marketId: string | null; vault: string | null; vaultBalance: string | null; onchainStatus: string | null; evidenceStatus: "researching_evidence"; targetCityHash: string };
  noaaEvidence: { status: "researching_evidence"; settlementSource: "NOAA"; message: string };
  generatedAt: string;
}

export class DevnetStatusReader {
  private readonly connection = new Connection(RPC_URL, "confirmed");
  private readonly programId = new PublicKey(PROGRAM_ID);
  private readonly mint = new PublicKey(SKYT_MINT);
  private readonly idl: Idl;
  private readonly coder: BorshCoder;

  constructor() {
    this.idl = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "shared/idl/skyhedge_protection.json"), "utf8")) as Idl;
    this.coder = new BorshCoder(this.idl);
  }

  async read(): Promise<DevnetStatus> {
    const [programInfo, mintInfo] = await Promise.all([
      this.connection.getAccountInfo(this.programId, "finalized").catch(() => null),
      getMint(this.connection, this.mint, "finalized").catch(() => null),
    ]);
    const [protocolAddress] = PublicKey.findProgramAddressSync([Buffer.from("protocol")], this.programId);
    const [feeVaultAddress] = PublicKey.findProgramAddressSync([Buffer.from("fee-vault"), protocolAddress.toBuffer()], this.programId);
    const protocolInfo = await this.connection.getAccountInfo(protocolAddress, "finalized").catch(() => null);
    const decodedProtocol = protocolInfo ? this.decodeAccount<Record<string, unknown>>("ProtocolConfig", protocolInfo.data) : null;
    const feeVaultBalance = await this.tokenBalance(feeVaultAddress);
    const market = decodedProtocol ? await this.findDesMoinesMarket(protocolAddress, decodedProtocol) : null;

    return {
      network: process.env.SOLANA_NETWORK ?? "devnet",
      rpcUrl: RPC_URL,
      program: {
        address: this.programId.toBase58(),
        status: programInfo?.executable ? "ready" : "pending",
        executable: Boolean(programInfo?.executable),
        explorerUrl: `https://explorer.solana.com/address/${this.programId.toBase58()}?cluster=devnet`,
      },
      idl: {
        status: "ready",
        source: "local-committed-idl",
        instructionCount: this.idl.instructions?.length ?? 0,
        accountCount: this.idl.accounts?.length ?? 0,
      },
      protocol: {
        address: protocolAddress.toBase58(),
        status: decodedProtocol ? "ready" : "pending",
        initialized: Boolean(decodedProtocol),
        admin: pubkeyString(decodedProtocol?.admin),
        settlementAuthority: pubkeyString(decodedProtocol?.settlementAuthority),
        collateralMint: pubkeyString(decodedProtocol?.collateralMint),
        nextMarketId: bnString(decodedProtocol?.nextMarketId),
      },
      feeVault: {
        address: feeVaultAddress.toBase58(),
        status: feeVaultBalance === null ? "pending" : "ready",
        exists: feeVaultBalance !== null,
        balance: feeVaultBalance,
      },
      skytMint: {
        address: this.mint.toBase58(),
        status: mintInfo ? "ready" : "pending",
        exists: Boolean(mintInfo),
        decimals: mintInfo?.decimals ?? null,
        supply: mintInfo?.supply.toString() ?? null,
        mintAuthority: mintInfo?.mintAuthority?.toBase58() ?? null,
      },
      desMoinesMarket: market ?? {
        status: "pending",
        address: null,
        marketId: null,
        vault: null,
        vaultBalance: null,
        onchainStatus: null,
        evidenceStatus: "researching_evidence",
        targetCityHash: cityHash("des-moines"),
      },
      noaaEvidence: {
        status: "researching_evidence",
        settlementSource: "NOAA",
        message: "Des Moines remains gated until its final NOAA station and evidence package are pinned.",
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private decodeAccount<T>(name: string, data: Buffer): T | null {
    try {
      return this.coder.accounts.decode(name, data) as T;
    } catch {
      return null;
    }
  }

  private async findDesMoinesMarket(protocol: PublicKey, decodedProtocol: Record<string, unknown>): Promise<DevnetStatus["desMoinesMarket"] | null> {
    const nextMarketId = BigInt(bnString(decodedProtocol.nextMarketId) ?? "0");
    const targetHashes = new Set([cityHash("des-moines"), cityHash("Des Moines")]);
    for (let id = 0n; id < nextMarketId; id++) {
      const [marketAddress] = PublicKey.findProgramAddressSync([Buffer.from("market"), protocol.toBuffer(), u64Le(id)], this.programId);
      const marketInfo = await this.connection.getAccountInfo(marketAddress, "finalized").catch(() => null);
      if (!marketInfo) continue;
      const market = this.decodeAccount<Record<string, unknown>>("Market", marketInfo.data);
      const marketCityHash = bytesHex(market?.cityHash);
      if (!targetHashes.has(marketCityHash)) continue;
      const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), marketAddress.toBuffer()], this.programId);
      return {
        status: "ready",
        address: marketAddress.toBase58(),
        marketId: id.toString(),
        vault: vault.toBase58(),
        vaultBalance: await this.tokenBalance(vault),
        onchainStatus: JSON.stringify(market?.status ?? null),
        evidenceStatus: "researching_evidence",
        targetCityHash: marketCityHash,
      };
    }
    return null;
  }

  private async tokenBalance(address: PublicKey): Promise<string | null> {
    try {
      const balance = await this.connection.getTokenAccountBalance(address, "finalized");
      return balance.value.amount;
    } catch {
      return null;
    }
  }
}

function cityHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function u64Le(value: bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value);
  return buffer;
}

function bytesHex(value: unknown): string {
  if (Array.isArray(value)) return Buffer.from(value).toString("hex");
  if (Buffer.isBuffer(value)) return value.toString("hex");
  return "";
}

function pubkeyString(value: unknown): string | null {
  return value && typeof value === "object" && "toBase58" in value ? (value as PublicKey).toBase58() : null;
}

function bnString(value: unknown): string | null {
  return value && typeof value === "object" && "toString" in value ? (value as { toString(): string }).toString() : null;
}
