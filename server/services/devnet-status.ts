import { createHash } from "node:crypto";
import { BorshCoder, type Idl } from "@coral-xyz/anchor";
import { getMint } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import committedIdl from "../../shared/idl/skyhedge_protection.json" with { type: "json" };
import methodology from "../../shared/methodology-v1.json" with { type: "json" };
import { canonicalSourceHash, NOAA_STATIONS } from "./noaa.js";
import { getDesMoinesEvidencePackage, type DesMoinesEvidencePackage } from "./des-moines-evidence.js";
import { marketStateFromStatusJson } from "../../shared/des-moines-seed-plan.js";
import { LIVE_CITY_SLUGS, tenorOf, type LiveCitySlug, type Tenor } from "../../shared/window-ladder.js";
import type { WindowEvidencePackage } from "../../shared/window-chain.js";
import { callWithRpcFailover, prepareRpcUrls } from "./rpc-failover.js";
import { readStoredWindowEvidence } from "./window-evidence.js";

const PROGRAM_ID = process.env.SKYHEDGE_PROGRAM_ID ?? "5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx";
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const SKYT_MINT = process.env.SKYT_MINT ?? "3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g";
const STATUS_CACHE_MS = 20_000;
/** Public Devnet endpoints. web3.js 429 retry stays off; the first URL is retried with backoff, then the fallback, under a strict timeout. */
function devnetRpcUrls(): string[] {
  return prepareRpcUrls();
}

function devnetConnection(url: string): Connection {
  return new Connection(url, { commitment: "confirmed", disableRetryOnRateLimit: true });
}

type Status = "ready" | "pending" | "unavailable" | "error";
type EvidenceStatus = "ready" | "pending" | "unavailable";

export interface DevnetStatus {
  network: string;
  rpcUrl: string;
  program: { address: string; status: Status; executable: boolean; explorerUrl: string };
  idl: { status: Status; source: "local-committed-idl"; instructionCount: number; accountCount: number; supportsEmptyDraftCancellation: boolean };
  protocol: { address: string; status: Status; initialized: boolean; admin: string | null; settlementAuthority: string | null; collateralMint: string | null; nextMarketId: string | null };
  feeVault: { address: string; status: Status; exists: boolean; balance: string | null };
  skytMint: { address: string; status: Status; exists: boolean; decimals: number | null; supply: string | null; mintAuthority: string | null };
  desMoinesMarket: { status: Status; address: string | null; marketId: string | null; vault: string | null; vaultBalance: string | null; onchainStatus: string | null; salesCloseAt: number | null; observationStart: number | null; observationEnd: number | null; thresholdMmX100: string | null; operator: "gt" | "gte" | "lt" | "lte" | null; quoteProbabilityBps: number | null; premiumRateBps: number | null; quoteInputsHash: string | null; evidenceStatus: "researching_evidence" | "validated"; targetCityHash: string };
  /** Non-cancelled Des Moines markets, including drafts, so the keeper can avoid duplicates. */
  ladderMarkets: LadderMarketSnapshot[];
  /** Weekly and monthly windows that are open, funded, and still selling. */
  cityWindows: CityWindowSnapshot[];
  noaaEvidence: { status: EvidenceStatus; settlementSource: "NOAA"; message: string; package: Pick<DesMoinesEvidencePackage, "stationId" | "stationIdHash" | "providerHash" | "methodologyHash" | "seedSchedule" | "quoteTerms" | "evidence"> | null };
  /** Validated NOAA analogue packages for open ladder windows. Empty until the keeper or city route builds them. */
  windowEvidence: WindowEvidencePackage[];
  generatedAt: string;
}

/** Remove the credential-bearing RPC endpoint before status reaches public clients. */
export function publicDevnetStatus<T extends { rpcUrl: string }>(status: T): Omit<T, "rpcUrl"> {
  const { rpcUrl: _rpcUrl, ...publicStatus } = status;
  return publicStatus;
}

export interface LadderMarketSnapshot {
  city: LiveCitySlug;
  marketId: string;
  address: string;
  state: "draft" | "open" | "cancelled" | "other";
  salesCloseAt: number | null;
  observationStart: number | null;
  observationEnd: number | null;
  vaultBalance: string | null;
  tenor: Tenor | null;
}

export interface CityWindowSnapshot {
  city: LiveCitySlug;
  tenor: Tenor;
  status: "ready";
  address: string;
  marketId: string;
  vault: string;
  vaultBalance: string | null;
  onchainStatus: string | null;
  salesCloseAt: number | null;
  observationStart: number;
  observationEnd: number;
  thresholdMmX100: string | null;
  operator: "gt" | "gte" | "lt" | "lte" | null;
  quoteProbabilityBps: number | null;
  premiumRateBps: number | null;
  quoteInputsHash: string | null;
  evidenceStatus: "researching_evidence" | "validated";
}

export function noaaStationValidationMessage(windowStart: string, windowEnd: string): string {
  return `Historical NOAA sample for ${windowStart} through ${windowEnd} confirms station data availability only; it does not validate a future market window, settlement rainfall, or pricing.`;
}

export class DevnetStatusReader {
  private connection: Connection;
  private readonly injected: boolean;
  private readonly programId = new PublicKey(PROGRAM_ID);
  private readonly mint = new PublicKey(SKYT_MINT);
  private readonly idl: Idl;
  private readonly coder: BorshCoder;
  private evidenceCache: { expiresAt: number; value: DevnetStatus["noaaEvidence"] } | null = null;
  private statusCache: { at: number; value: Promise<DevnetStatus> } | null = null;

  constructor(connection?: Connection) {
    this.injected = connection != null;
    this.connection = connection ?? devnetConnection(devnetRpcUrls()[0] ?? RPC_URL);
    this.idl = committedIdl as unknown as Idl;
    this.coder = new BorshCoder(this.idl);
  }

  async read(): Promise<DevnetStatus> {
    if (this.injected) return this.readUncached();
    if (this.statusCache && Date.now() - this.statusCache.at < STATUS_CACHE_MS) return this.statusCache.value;
    const run = this.readWithFailover();
    this.statusCache = { at: Date.now(), value: run };
    try {
      return await run;
    } catch (error) {
      if (this.statusCache?.value === run) this.statusCache = null;
      throw error;
    }
  }

  private async readWithFailover(): Promise<DevnetStatus> {
    return callWithRpcFailover(devnetRpcUrls(), async (url) => {
      this.connection = devnetConnection(url);
      return this.readUncached();
    });
  }

  private async readUncached(): Promise<DevnetStatus> {
    const [programInfo, mintAccountInfo, noaaEvidence, windowEvidence] = await Promise.all([
      this.connection.getAccountInfo(this.programId, "confirmed"),
      this.connection.getAccountInfo(this.mint, "confirmed"),
      this.readNoaaEvidence(),
      readStoredWindowEvidence().catch(() => [] as WindowEvidencePackage[]),
    ]);
    const mintInfo = mintAccountInfo ? await getMint(this.connection, this.mint, "confirmed") : null;
    const [protocolAddress] = PublicKey.findProgramAddressSync([Buffer.from("protocol")], this.programId);
    const [feeVaultAddress] = PublicKey.findProgramAddressSync([Buffer.from("fee-vault"), protocolAddress.toBuffer()], this.programId);
    const protocolInfo = await this.connection.getAccountInfo(protocolAddress, "confirmed");
    const decodedProtocol = protocolInfo ? this.decodeAccount<Record<string, unknown>>("ProtocolConfig", protocolInfo.data) : null;
    const feeVaultBalance = await this.tokenBalance(feeVaultAddress);
    const markets = decodedProtocol ? await this.listDesMoinesMarkets(protocolAddress, decodedProtocol) : [];
    const market = latestMatchingMarket(markets, new Set([cityHash("des-moines"), cityHash("Des Moines")]));
    const ladderMarkets = markets.map((item) => ladderSnapshot(item));
    const cityWindows = markets.flatMap((item) => sellingWindow(item, Math.floor(Date.now() / 1_000)))
      .sort((left, right) => left.observationStart - right.observationStart);

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
        supportsEmptyDraftCancellation: supportsEmptyDraftCancellation(
          this.idl,
          process.env.SKYHEDGE_DEVNET_CANCEL_EMPTY_DRAFT_READY === "true",
        ),
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
      ladderMarkets,
      cityWindows,
      noaaEvidence,
      windowEvidence,
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

  private async listDesMoinesMarkets(protocol: PublicKey, decodedProtocol: Record<string, unknown>): Promise<ListedMarket[]> {
    const nextMarketId = BigInt(protocolConfigFields(decodedProtocol).nextMarketId ?? "0");
    const found: ListedMarket[] = [];
    const chunkSize = 100;
    for (let start = 0n; start < nextMarketId; start += BigInt(chunkSize)) {
      const end = start + BigInt(chunkSize) < nextMarketId ? start + BigInt(chunkSize) : nextMarketId;
      const ids: bigint[] = [];
      for (let id = start; id < end; id++) ids.push(id);
      const addresses = ids.map((id) => PublicKey.findProgramAddressSync([Buffer.from("market"), protocol.toBuffer(), u64Le(id)], this.programId)[0]);
      const accounts = await this.connection.getMultipleAccountsInfo(addresses, "confirmed");
      for (let index = 0; index < accounts.length; index++) {
        const account = accounts[index];
        if (!account) continue;
        const decoded = this.decodeAccount<Record<string, unknown>>("Market", account.data);
        const marketCityHash = bytesHex(decoded?.city_hash);
        const slug = slugForCityHash(marketCityHash);
        if (!slug) continue;
        const marketAddress = addresses[index];
        const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), marketAddress.toBuffer()], this.programId);
        found.push({
          id: ids[index],
          city: slug,
          cityHash: marketCityHash,
          status: "ready",
          address: marketAddress.toBase58(),
          marketId: ids[index].toString(),
          vault: vault.toBase58(),
          vaultBalance: await this.tokenBalance(vault),
          onchainStatus: JSON.stringify(decoded?.status ?? null),
          ...marketTermsFields(decoded),
          evidenceStatus: hasPinnedStationEvidence(decoded, NOAA_STATIONS[slug].stationId) ? "validated" : "researching_evidence",
          targetCityHash: marketCityHash,
          raw: decoded ?? {},
        });
      }
    }
    return found;
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
    const account = await this.connection.getAccountInfo(address, "confirmed");
    if (!account) return null;
    const balance = await this.connection.getTokenAccountBalance(address, "confirmed");
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

type ListedMarket = DevnetStatus["desMoinesMarket"] & { raw: Record<string, unknown>; id: bigint; city: LiveCitySlug; cityHash: string };

function marketStatus(market: ListedMarket): DevnetStatus["desMoinesMarket"] {
  const { raw: _raw, id: _id, city: _city, cityHash: _cityHash, ...status } = market;
  return status;
}

function ladderSnapshot(market: ListedMarket): LadderMarketSnapshot {
  const state = marketStateFromStatusJson(market.onchainStatus);
  const tenor = market.observationStart != null && market.observationEnd != null
    ? tenorOf(market.observationStart, market.observationEnd)
    : null;
  return {
    city: market.city,
    marketId: market.marketId ?? market.id.toString(),
    address: market.address ?? "",
    state: state === "draft" || state === "open" || state === "cancelled" ? state : "other",
    salesCloseAt: market.salesCloseAt,
    observationStart: market.observationStart,
    observationEnd: market.observationEnd,
    vaultBalance: market.vaultBalance,
    tenor,
  };
}

function slugForCityHash(hash: string): LiveCitySlug | null {
  for (const slug of LIVE_CITY_SLUGS) {
    if (cityHash(slug) === hash) return slug;
  }
  if (hash === cityHash("Des Moines")) return "des-moines";
  return null;
}

function sellingWindow(market: ListedMarket, nowSeconds: number): CityWindowSnapshot[] {
  const tenor = market.observationStart != null && market.observationEnd != null
    ? tenorOf(market.observationStart, market.observationEnd)
    : null;
  const open = Boolean(market.onchainStatus && /"open"\s*:/i.test(market.onchainStatus));
  if (!tenor || !open || !market.address || !market.marketId || !market.vault) return [];
  if (market.evidenceStatus !== "validated") return [];
  if (market.quoteProbabilityBps == null || market.premiumRateBps == null || !market.quoteInputsHash) return [];
  if (!market.salesCloseAt || market.salesCloseAt <= nowSeconds) return [];
  if (!market.vaultBalance || !/^\d+$/.test(market.vaultBalance) || BigInt(market.vaultBalance) === 0n) return [];
  return [{
    city: market.city,
    tenor,
    status: "ready",
    address: market.address,
    marketId: market.marketId,
    vault: market.vault,
    vaultBalance: market.vaultBalance,
    onchainStatus: market.onchainStatus,
    salesCloseAt: market.salesCloseAt,
    observationStart: market.observationStart!,
    observationEnd: market.observationEnd!,
    thresholdMmX100: market.thresholdMmX100,
    operator: market.operator,
    quoteProbabilityBps: market.quoteProbabilityBps,
    premiumRateBps: market.premiumRateBps,
    quoteInputsHash: market.quoteInputsHash,
    evidenceStatus: market.evidenceStatus,
  }];
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

/** An IDL entry alone is insufficient: operators enable this only after verifying the Devnet upgrade. */
export function supportsEmptyDraftCancellation(idl: unknown, deployedFeatureVerified: boolean): boolean {
  if (!deployedFeatureVerified || !idl || typeof idl !== "object" || !("instructions" in idl)) return false;
  const instructions = (idl as { instructions?: unknown }).instructions;
  return Array.isArray(instructions) && instructions.some((instruction) => instruction
    && typeof instruction === "object" && "name" in instruction
    && (instruction as { name?: unknown }).name === "cancel_empty_draft_market");
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
  return hasPinnedStationEvidence(decoded, NOAA_STATIONS["des-moines"].stationId);
}

export function hasPinnedStationEvidence(decoded: Record<string, unknown> | null | undefined, stationId: string): boolean {
  if (bytesHex(decoded?.station_id_hash) !== canonicalSourceHash(stationId)) return false;
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
