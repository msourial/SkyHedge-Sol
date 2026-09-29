import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { Connection, Keypair, PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet, type Idl } from "@coral-xyz/anchor";
import committedIdl from "../../shared/idl/skyhedge_protection.json" with { type: "json" };
import { eq } from "drizzle-orm";
import { BN } from "bn.js";
type BNInstance = InstanceType<typeof BN>;
import type { Db } from "../db";
import { settlementEvidence } from "../../shared/schema.js";
import { RainfallConsensusService, utcDailyObservationRange, type ConsensusResult } from "./consensus.js";
import { canonicalSourceHash, NOAA_STATIONS, type SkyHedgeCity } from "./noaa.js";
import { DATA_GRACE_SECONDS } from "./settlement-constants.js";

const PROGRAM_ID = process.env.SKYHEDGE_PROGRAM_ID ?? "5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx";
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const SETTLEMENT_KEYPAIR_ENV = process.env.SETTLEMENT_AUTHORITY_KEYPAIR;

interface MarketState { address: string; marketId: number; status: string; result: string; salesCloseAt: number; observationStart: number; observationEnd: number; dataDeadline: number; cityHash: string; }
type UnavailableEvidence = {
  methodologyVersion: string;
  city: string;
  windowStart: string;
  windowEnd: string;
  noaa: { stationId: string; cumulativeMm: null; records: [] };
  verdict: "DATA_UNAVAILABLE";
  rule: "NOAA quality-screened daily observation";
  reason: string;
  sourceHash: string;
  generatedAt: string;
};

/**
 * SettlementRunner: drives AWAITING_SETTLEMENT markets through deterministic
 * quality-screened NOAA observations → submit_weather_observation + settle_market, or
 * mark_data_unavailable after the data deadline. Idempotent: every action
 * re-checks on-chain status first. Never synthesizes weather values.
 */
export class SettlementRunner {
  private readonly connection = new Connection(RPC_URL, "finalized");
  private readonly program: Program;
  private readonly programId = new PublicKey(PROGRAM_ID);
  private readonly consensus = new RainfallConsensusService();
  private readonly settlementKeypair: Keypair;
  private readonly provider: AnchorProvider;
  private running = false;

  constructor(private readonly db?: Db, settlementKeypairPath?: string) {
    const idl = committedIdl as unknown as Idl;
    this.settlementKeypair = loadSettlementKeypair(settlementKeypairPath ?? SETTLEMENT_KEYPAIR_ENV);
    const provider = new AnchorProvider(this.connection, new Wallet(this.settlementKeypair), { commitment: "finalized", preflightCommitment: "confirmed" });
    this.provider = provider;
    this.program = new Program(idl, provider);
  }

  start(intervalMs = 60_000): () => void {
    const run = () => { void this.runOnce().catch((error) => console.error("[settlement] run failed:", error)); };
    void run();
    const timer = setInterval(run, intervalMs);
    return () => clearInterval(timer);
  }

  async runOnce(): Promise<{ scanned: number; advanced: Array<{ market: string; action: "lock_market" | "begin_settlement"; signature: string }>; settled: string[]; markedUnavailable: string[]; pending: string[] }> {
    if (this.running) return { scanned: 0, advanced: [], settled: [], markedUnavailable: [], pending: [] };
    this.running = true;
    try {
      const protocolAddress = PublicKey.findProgramAddressSync([Buffer.from("protocol")], this.programId)[0];
      const accounts = this.program.account as unknown as Record<string, { fetch: (address: PublicKey) => Promise<Record<string, unknown>> }>;
      const protocol = (await accounts["protocolConfig"].fetch(protocolAddress)) as unknown as { nextMarketId: BNInstance };
      const advanced: Array<{ market: string; action: "lock_market" | "begin_settlement"; signature: string }> = [];
      const settled: string[] = [];
      const markedUnavailable: string[] = [];
      const pending: string[] = [];

      for (let id = 0n; id < BigInt(protocol.nextMarketId.toString()); id++) {
        const [marketAddress] = PublicKey.findProgramAddressSync([Buffer.from("market"), protocolAddress.toBuffer(), toLeBytes(id)], this.programId);
        const market = (await accounts["market"].fetch(marketAddress)) as unknown as {
          status: unknown;
          salesCloseAt: BNInstance;
          dataDeadline: BNInstance;
          observationStart: BNInstance;
          observationEnd: BNInstance;
          cityHash: number[];
          stationIdHash: number[];
          methodologyHash: number[];
        };
        let lifecycleStatus = marketStatusTag(market.status);
        if (!["open", "locked", "awaitingsettlement"].includes(lifecycleStatus)) continue;
        const finalizedSlot = await this.connection.getSlot("finalized");
        const now = await this.connection.getBlockTime(finalizedSlot);
        if (now === null) { pending.push(marketAddress.toBase58()); continue; }

        const salesCloseAt = market.salesCloseAt.toNumber();
        const observationEnd = market.observationEnd.toNumber();
        const firstTransition = nextMarketLifecycleAction(lifecycleStatus, now, salesCloseAt, observationEnd);
        if (firstTransition === "lock_market") {
          const signature = await this.program.methods.lockMarket().accounts({ market: marketAddress }).rpc();
          advanced.push({ market: marketAddress.toBase58(), action: firstTransition, signature });
          lifecycleStatus = "locked";
        }
        if (nextMarketLifecycleAction(lifecycleStatus, now, salesCloseAt, observationEnd) === "begin_settlement") {
          const signature = await this.program.methods.beginSettlement().accounts({ market: marketAddress }).rpc();
          advanced.push({ market: marketAddress.toBase58(), action: "begin_settlement", signature });
          lifecycleStatus = "awaitingsettlement";
        }
        if (lifecycleStatus !== "awaitingsettlement") { pending.push(marketAddress.toBase58()); continue; }

        if (now > market.dataDeadline.toNumber()) {
          const city = this.cityForHash(Buffer.from(market.cityHash).toString("hex"));
          const evidence = await this.deadlineEvidence(marketAddress.toBase58(), city, market.observationStart.toNumber(), market.observationEnd.toNumber());
          const sourceHash = evidence.sourceHash;
          const unavailableSignature = await this.program.methods.markDataUnavailable(sourceHashBytes(sourceHash))
            // Anchor's client resolves omitted optional accounts as their PDA. Pass
            // the program-id sentinel explicitly to encode `None` for an absent
            // settlement observation; otherwise this path cannot mark the market
            // unavailable when NOAA data never arrived.
            .accountsPartial({ authority: this.authority().publicKey, market: marketAddress, protocol: protocolAddress, observation: this.programId })
            .rpc();
          await this.persistEvidence(evidence, marketAddress.toBase58(), "DATA_UNAVAILABLE", { authority: this.authority().publicKey.toBase58(), unavailableSignature, commitment: "finalized" });
          markedUnavailable.push(marketAddress.toBase58());
          console.log(`[settlement] market ${marketAddress.toBase58()} marked DATA_UNAVAILABLE (deadline passed)`);
          continue;
        }

        const city = this.cityForHash(Buffer.from(market.cityHash).toString("hex"));
        if (!city) { pending.push(marketAddress.toBase58()); continue; }
        const { start: windowStart, end: windowEnd } = utcDailyObservationRange(market.observationStart.toNumber(), market.observationEnd.toNumber());

        let result: ConsensusResult;
        try {
          result = await this.consensus.evidenceFor(city, windowStart, windowEnd);
        } catch {
          pending.push(marketAddress.toBase58());
          continue;
        }
        if (result.verdict !== "AGREED") { pending.push(marketAddress.toBase58()); continue; }

        const station = NOAA_STATIONS[city];
        if (result.evidence.city !== city || result.evidence.noaa.stationId !== station.stationId || result.evidence.windowStart !== windowStart || result.evidence.windowEnd !== windowEnd) {
          pending.push(marketAddress.toBase58());
          continue;
        }
        if (!Buffer.from(market.stationIdHash).equals(Buffer.from(canonicalSourceHash(station.stationId), "hex"))) {
          pending.push(marketAddress.toBase58());
          continue;
        }
        const methodologyHash = canonicalSourceHash(result.evidence.methodologyVersion);
        if (!Buffer.from(market.methodologyHash).equals(Buffer.from(methodologyHash, "hex")) || !/^[a-f0-9]{64}$/i.test(result.evidence.sourceHash)) {
          pending.push(marketAddress.toBase58());
          continue;
        }

        const valueMmX100 = Math.round(result.finalValueMm! * 100);
        const authority = this.authority();
        const stationHashBytes = Array.from(Buffer.from(canonicalSourceHash(station.stationId), "hex"));
        const methodologyHashBytes = Array.from(Buffer.from(methodologyHash, "hex"));
        const [observationAddress] = PublicKey.findProgramAddressSync([Buffer.from("settlement"), marketAddress.toBuffer()], this.programId);
        let observationSignature: string;
        let settlementSignature: string;
        const observationAccountInfo = await this.connection.getAccountInfo(observationAddress, "finalized");
        if (observationAccountInfo) {
          const existing = (await accounts["settlementObservation"].fetch(observationAddress)) as unknown as {
            authority: PublicKey;
            stationIdHash: number[];
            methodologyHash: number[];
            observationWindowStart: BNInstance;
            observationWindowEnd: BNInstance;
            cumulativeRainfallMmX100: BNInstance;
            sourceHash: number[];
          };
          const sameEvidence = existing.cumulativeRainfallMmX100.toNumber() === valueMmX100
            && existing.observationWindowStart.toNumber() === market.observationStart.toNumber()
            && existing.observationWindowEnd.toNumber() === market.observationEnd.toNumber()
            && Buffer.from(existing.stationIdHash).equals(Buffer.from(stationHashBytes))
            && Buffer.from(existing.methodologyHash).equals(Buffer.from(methodologyHashBytes))
            && Buffer.from(existing.sourceHash).equals(Buffer.from(sourceHashBytes(result.evidence.sourceHash)));
          if (!sameEvidence) { pending.push(marketAddress.toBase58()); continue; }
          const signatures = await this.connection.getSignaturesForAddress(observationAddress, { limit: 5 }, "finalized");
          observationSignature = signatures.find((item) => !item.err)?.signature ?? "";
          settlementSignature = await this.program.methods.settleMarket()
            .accounts({ market: marketAddress, protocol: protocolAddress, settlementAuthority: authority.publicKey, observation: observationAddress })
            .signers([authority])
            .rpc();
        } else {
          const observationInstruction = await this.program.methods
            .submitWeatherObservation({
              stationIdHash: stationHashBytes,
              methodologyHash: methodologyHashBytes,
              observationWindowStart: market.observationStart,
              observationWindowEnd: market.observationEnd,
              cumulativeRainfallMmX100: new BN(valueMmX100),
              observedAt: market.observationEnd,
              sourceHash: sourceHashBytes(result.evidence.sourceHash),
            })
            .accounts({ authority: authority.publicKey, protocol: protocolAddress, market: marketAddress, observation: observationAddress })
            .instruction();
          const settlementInstruction = await this.program.methods.settleMarket()
            .accounts({ market: marketAddress, protocol: protocolAddress, settlementAuthority: authority.publicKey, observation: observationAddress })
            .instruction();
          settlementSignature = await submitObservationAndSettlementAtomically(this.provider, observationInstruction, settlementInstruction, authority);
          observationSignature = settlementSignature;
        }
        await this.persistEvidence(result.evidence, marketAddress.toBase58(), "AGREED", { authority: authority.publicKey.toBase58(), observationSignature, settlementSignature, commitment: "finalized" });
        settled.push(marketAddress.toBase58());
        console.log(`[settlement] market ${marketAddress.toBase58()} settled with ${valueMmX100 / 100}mm (${city})`);
      }
      return { scanned: Number(protocol.nextMarketId), advanced, settled, markedUnavailable, pending };
    } finally {
      this.running = false;
    }
  }

  private authority(): Keypair {
    return this.settlementKeypair;
  }

  private async deadlineEvidence(marketAddress: string, city: SkyHedgeCity | null, startSeconds: number, endSeconds: number): Promise<UnavailableEvidence> {
    const generatedAt = new Date().toISOString();
    const range = utcDailyObservationRange(startSeconds, endSeconds);
    const evidence: UnavailableEvidence = { methodologyVersion: "methodology-v1", city: city ?? "unknown", windowStart: range.start, windowEnd: range.end, noaa: { stationId: city ? NOAA_STATIONS[city].stationId : "unknown", cumulativeMm: null, records: [] }, verdict: "DATA_UNAVAILABLE", rule: "NOAA quality-screened daily observation", reason: "No complete NOAA observation package passed quality checks by the immutable on-chain deadline.", sourceHash: "", generatedAt };
    evidence.sourceHash = canonicalHash({ marketAddress, reason: "data_deadline_exceeded", generatedAt });
    return evidence;
  }

  private async persistEvidence(evidence: ConsensusResult["evidence"] | UnavailableEvidence, marketAddress: string, verdict: string, attestation: Record<string, string>): Promise<void> {
    if (!this.db) return;
    await this.db.insert(settlementEvidence).values({
      sourceHash: evidence.sourceHash,
      marketAddress,
      city: evidence.city,
      windowStart: evidence.windowStart,
      windowEnd: evidence.windowEnd,
      methodologyVersion: evidence.methodologyVersion,
      verdict,
      noaaMm: evidence.noaa.cumulativeMm === null ? "" : String(evidence.noaa.cumulativeMm),
      wxmMm: null,
      deltaMm: null,
      toleranceMm: null,
      evidence: { ...evidence, oracleAttestation: attestation },
    }).onConflictDoNothing();
  }

  private cityForHash(hash: string): SkyHedgeCity | null {
    for (const city of Object.keys(NOAA_STATIONS) as SkyHedgeCity[]) {
      if (createHash("sha256").update(city).digest("hex") === hash) return city;
    }
    return null;
  }
}

export function submitObservationAndSettlementAtomically(
  provider: Pick<AnchorProvider, "sendAndConfirm">,
  observationInstruction: TransactionInstruction,
  settlementInstruction: TransactionInstruction,
  authority: Keypair,
): Promise<string> {
  const transaction = new Transaction().add(observationInstruction, settlementInstruction);
  return provider.sendAndConfirm(transaction, [authority], { commitment: "finalized", preflightCommitment: "confirmed" });
}

export type MarketLifecycleAction = "lock_market" | "begin_settlement";

/** Selects a permissionless on-chain transition only after its immutable deadline. */
export function nextMarketLifecycleAction(status: unknown, chainNow: number, salesCloseAt: number, observationEnd: number): MarketLifecycleAction | null {
  const normalized = marketStatusTag(status);
  if (normalized === "open" && chainNow >= salesCloseAt) return "lock_market";
  if (normalized === "locked" && chainNow >= observationEnd) return "begin_settlement";
  return null;
}

function marketStatusTag(status: unknown): string {
  const value = typeof status === "string"
    ? status
    : status && typeof status === "object"
      ? Object.keys(status)[0] ?? ""
      : "";
  return value.replaceAll(/[_\s-]/g, "").toLowerCase();
}

export function loadSettlementKeypair(envPath?: string): Keypair {
  const configured = envPath?.trim();
  const secretKey = configured?.startsWith("[")
    ? parseSettlementSecretKey(configured)
    : JSON.parse(fs.readFileSync(configured ? (path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured)) : path.resolve(process.cwd(), "anchor/keys/settlement-authority.json"), "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

function parseSettlementSecretKey(value: string): number[] {
  let parsed: unknown;
  try { parsed = JSON.parse(value); }
  catch { throw new Error("SETTLEMENT_AUTHORITY_KEYPAIR must be a JSON array of 64 secret-key bytes or a keypair file path."); }
  if (!Array.isArray(parsed) || parsed.length !== 64 || parsed.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
    throw new Error("SETTLEMENT_AUTHORITY_KEYPAIR must be a JSON array of 64 secret-key bytes or a keypair file path.");
  }
  return parsed as number[];
}

export function sourceHashBytes(hash: string): number[] {
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error("NOAA source hash must be a 32-byte SHA-256 value.");
  return Array.from(Buffer.from(hash, "hex"));
}

function canonicalHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function toLeBytes(value: bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value);
  return buffer;
}
