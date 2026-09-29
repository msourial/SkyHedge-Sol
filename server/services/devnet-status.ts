import { createHash } from "node:crypto";
import { BorshCoder, type Idl } from "@coral-xyz/anchor";
import { getMint } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import committedIdl from "../../shared/idl/skyhedge_protection.json";
import methodology from "../../shared/methodology-v1.json";
import { canonicalSourceHash, NOAA_STATIONS } from "./noaa.js";
import { getDesMoinesEvidencePackage, type DesMoinesEvidencePackage } from "./des-moines-evidence.js";

const PROGRAM_ID = process.env.SKYHEDGE_PROGRAM_ID ?? "5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx";
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const SKYT_MINT = process.env.SKYT_MINT ?? "3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g";

type Status = "ready" | "pending" | "unavailable" | "error";
type EvidenceStatus = "ready" | "pending" | "unavailable";

export interface DevnetStatus {
  network: string;
  rpcUrl: string;
  program: { address: string; status: Status; executable: boolean; explorerUrl: string };
  idl: { status: Status; source: "local-committed-idl"; instructionCount: number; accountCount: number };
  protocol: { address: string; status: Status; initialized: boolean; admin: string | null; settlementAuthority: string | null; collateralMint: string | null; nextMarketId: string | null };
  feeVault: { address: string; status: Status; exists: boolean; balance: string | null };
  skytMint: { address: string; status: Status; exists: boolean; decimals: number | null; supply: string | null; mintAuthority: string | null };
  desMoinesMarket: { status: Status; address: string | null; marketId: string | null; vault: string | null; vaultBalance: string | null; onchainStatus: string | null; salesCloseAt: number | null; observationStart: number | null; observationEnd: number | null; thresholdMmX100: string | null; operator: "gt" | "gte" | "lt" | "lte" | null; quoteProbabilityBps: number | null; premiumRateBps: number | null; quoteInputsHash: string | null; evidenceStatus: "researching_evidence" | "validated"; targetCityHash: string };
  noaaEvidence: { status: EvidenceStatus; settlementSource: "NOAA"; message: string; package: Pick<DesMoinesEvidencePackage, "stationId" | "stationIdHash" | "providerHash" | "methodologyHash" | "seedSchedule" | "quoteTerms" | "evidence"> | null };
  generatedAt: string;
}

/** Remove the credential-bearing RPC endpoint before status reaches public clients. */
export function publicDevnetStatus<T extends { rpcUrl: string }>(status: T): Omit<T, "rpcUrl"> {
  const { rpcUrl: _rpcUrl, ...publicStatus } = status;
  return publicStatus;
}

export function noaaStationValidationMessage(windowStart: string, windowEnd: string): string {
  return `Historical NOAA sample for ${windowStart} through ${windowEnd} confirms station data availability only; it does not validate a future market window, settlement rainfall, or pricing.`;
}

export class DevnetStatusReader {
  private readonly connection: Connection;
  private readonly programId = new PublicKey(PROGRAM_ID);
  private readonly mint = new PublicKey(SKYT_MINT);
  private readonly idl: Idl;
  private readonly coder: BorshCoder;
  private evidenceCache: { expiresAt: number; value: DevnetStatus["noaaEvidence"] } | null = null;

  constructor(connection = new Connection(RPC_URL, "confirmed")) {
    this.connection = connection;
    this.idl = committedIdl as unknown as Idl;
    this.coder = new BorshCoder(this.idl);
  }

  async read(): Promise<DevnetStatus> {
    const [programInfo, mintAccountInfo, noaaEvidence] = await Promise.all([
      this.connection.getAccountInfo(this.programId, "finalized"),
      this.connection.getAccountInfo(this.mint, "finalized"),
      this.readNoaaEvidence(),
    ]);
    const mintInfo = mintAccountInfo ? await getMint(this.connection, this.mint, "finalized") : null;
    const [protocolAddress] = PublicKey.findProgramAddressSync([Buffer.from("protocol")], this.programId);
    const [feeVaultAddress] = PublicKey.findProgramAddressSync([Buffer.from("fee-vault"), protocolAddress.toBuffer()], this.programId);
    const protocolInfo = await this.connection.getAccountInfo(protocolAddress, "finalized");
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
        status: committedIdlMatchesProgram(this.idl, this.programId.toBase58()) ? "ready" : "error",
        source: "local-committed-idl",
        instructionCount: this.idl.instructions?.length ?? 0,
        accountCount: this.idl.accounts?.length ?? 0,
      },
      protocol: {
        address: protocolAddress.toBase58(),
        status: decodedProtocol ? "ready" : "pending",
        initialized: Boolean(decodedProtocol),
        admin: pubkeyString(decodedProtocol?.admin),
        ...protocolConfigFields(decodedProtocol),
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
      desMoinesMarket: market ? marketStatus(market) : {
        status: "pending",
        address: null,
        marketId: null,
        vault: null,
        vaultBalance: null,
        onchainStatus: null,
        salesCloseAt: null,
        observationStart: null,
        observationEnd: null,
        thresholdMmX100: null,
        operator: null,
        quoteProbabilityBps: null,
        premiumRateBps: null,
        quoteInputsHash: null,
        evidenceStatus: "researching_evidence",
        targetCityHash: cityHash("des-moines"),
      },
      noaaEvidence,
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

  private async findDesMoinesMarket(protocol: PublicKey, decodedProtocol: Record<string, unknown>): Promise<(DevnetStatus["desMoinesMarket"] & { raw: Record<string, unknown> }) | null> {
    const nextMarketId = BigInt(protocolConfigFields(decodedProtocol).nextMarketId ?? "0");
    const targetHashes = new Set([cityHash("des-moines"), cityHash("Des Moines")]);
    const chunkSize = 100;
    for (let end = nextMarketId; end > 0n;) {
      const start = end > BigInt(chunkSize) ? end - BigInt(chunkSize) : 0n;
      const ids: bigint[] = [];
      for (let id = end - 1n; id >= start; id--) ids.push(id);
      const addresses = ids.map((id) => PublicKey.findProgramAddressSync([Buffer.from("market"), protocol.toBuffer(), u64Le(id)], this.programId)[0]);
      const accounts = await this.connection.getMultipleAccountsInfo(addresses, "finalized");
      const candidates: Array<{ id: bigint; cityHash: string; address: string; raw: Record<string, unknown> }> = [];
      for (let index = 0; index < accounts.length; index++) {
        const account = accounts[index];
        if (!account) continue;
        const market = this.decodeAccount<Record<string, unknown>>("Market", account.data);
        const marketCityHash = bytesHex(market?.city_hash);
        if (!targetHashes.has(marketCityHash)) continue;
        candidates.push({ id: ids[index], cityHash: marketCityHash, address: addresses[index].toBase58(), raw: market ?? {} });
      }
      const latest = latestMatchingMarket(candidates, targetHashes);
      if (latest) {
        const marketAddress = new PublicKey(latest.address);
        const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), marketAddress.toBuffer()], this.programId);
        return {
          status: "ready",
          address: latest.address,
          marketId: latest.id.toString(),
          vault: vault.toBase58(),
          vaultBalance: await this.tokenBalance(vault),
          onchainStatus: JSON.stringify(latest.raw.status ?? null),
          ...marketTermsFields(latest.raw),
          evidenceStatus: hasPinnedDesMoinesEvidenceCommitment(latest.raw) ? "validated" : "researching_evidence",
          targetCityHash: latest.cityHash,
          raw: latest.raw,
        };
      }
      end = start;
    }
    return null;
  }

  private async readNoaaEvidence(): Promise<DevnetStatus["noaaEvidence"]> {
    if (this.evidenceCache && this.evidenceCache.expiresAt > Date.now()) return this.evidenceCache.value;
    try {
      const pkg = await getDesMoinesEvidencePackage();
      const value: DevnetStatus["noaaEvidence"] = {
        status: "ready",
        settlementSource: "NOAA",
        message: noaaStationValidationMessage(pkg.evidence.windowStart, pkg.evidence.windowEnd),
        package: {
          stationId: pkg.stationId,
          stationIdHash: pkg.stationIdHash,
          providerHash: pkg.providerHash,
          methodologyHash: pkg.methodologyHash,
          seedSchedule: pkg.seedSchedule,
          quoteTerms: pkg.quoteTerms,
          evidence: pkg.evidence,
        },
      };
      this.evidenceCache = { value, expiresAt: Date.now() + 60_000 };
      return value;
    } catch (error) {
      const value: DevnetStatus["noaaEvidence"] = {
        status: "unavailable",
        settlementSource: "NOAA",
        message: error instanceof Error ? error.message : "NOAA evidence validation is unavailable.",
        package: null,
      };
      this.evidenceCache = { value, expiresAt: Date.now() + 15_000 };
      return value;
    }
  }

  private async tokenBalance(address: PublicKey): Promise<string | null> {
    const account = await this.connection.getAccountInfo(address, "finalized");
    if (!account) return null;
    const balance = await this.connection.getTokenAccountBalance(address, "finalized");
    return balance.value.amount;
  }
}

/** Select the highest on-chain market ID matching the city, ignoring expired historical drafts. */
export function latestMatchingMarket<T extends { id: bigint; cityHash: string }>(markets: readonly T[], targetHashes: ReadonlySet<string>): T | null {
  let latest: T | null = null;
  for (const market of markets) {
    if (targetHashes.has(market.cityHash) && (latest === null || market.id > latest.id)) latest = market;
  }
  return latest;
}

function marketStatus(market: DevnetStatus["desMoinesMarket"] & { raw: Record<string, unknown> }): DevnetStatus["desMoinesMarket"] {
  const { raw: _raw, ...status } = market;
  return status;
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

/** Maps account fields exactly as emitted by Anchor's committed snake-case IDL. */
export function protocolConfigFields(decoded: Record<string, unknown> | null | undefined) {
  return {
    settlementAuthority: pubkeyString(decoded?.settlement_authority),
    collateralMint: pubkeyString(decoded?.collateral_mint),
    nextMarketId: bnString(decoded?.next_market_id),
  };
}

/** The committed IDL is usable only when it declares this deployed program. */
export function committedIdlMatchesProgram(idl: unknown, programAddress: string): boolean {
  return Boolean(idl && typeof idl === "object" && "address" in idl && (idl as { address?: unknown }).address === programAddress);
}

/** Maps immutable market terms emitted by Anchor's snake-case IDL. */
export function marketTermsFields(decoded: Record<string, unknown> | null | undefined) {
  return {
    salesCloseAt: bnNumber(decoded?.sales_close_at),
    observationStart: bnNumber(decoded?.observation_start),
    observationEnd: bnNumber(decoded?.observation_end),
    thresholdMmX100: bnString(decoded?.threshold_mm_x100),
    operator: marketOperator(decoded?.operator),
    quoteProbabilityBps: smallNumber(decoded?.quote_probability_bps),
    premiumRateBps: smallNumber(decoded?.premium_rate_bps),
    quoteInputsHash: bytesHex(decoded?.quote_inputs_hash) || null,
  };
}

/**
 * Validate the immutable evidence identity pinned by the admin when the
 * market was seeded. Do not compare it with today's rolling evidence package:
 * that package covers a different completed week after the calendar advances.
 */
export function hasPinnedDesMoinesEvidenceCommitment(decoded: Record<string, unknown> | null | undefined): boolean {
  if (bytesHex(decoded?.station_id_hash) !== canonicalSourceHash(NOAA_STATIONS["des-moines"].stationId)) return false;
  if (bytesHex(decoded?.provider_hash) !== canonicalSourceHash(methodology)) return false;
  if (bytesHex(decoded?.methodology_hash) !== canonicalSourceHash(methodology.version)) return false;
  const quoteInputsHash = bytesHex(decoded?.quote_inputs_hash);
  return /^[0-9a-f]{64}$/i.test(quoteInputsHash) && !/^0{64}$/i.test(quoteInputsHash);
}

function bnNumber(value: unknown): number | null {
  const string = bnString(value);
  if (!string) return null;
  const parsed = Number(string);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function smallNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) ? value : null;
  const parsed = bnNumber(value);
  return parsed;
}

function marketOperator(value: unknown): "gt" | "gte" | "lt" | "lte" | null {
  const normalized = JSON.stringify(value ?? {}).toLowerCase();
  if (normalized.includes("greaterthanorequal")) return "gte";
  if (normalized.includes("greaterthan")) return "gt";
  if (normalized.includes("lessthanorequal")) return "lte";
  if (normalized.includes("lessthan")) return "lt";
  return null;
}
