import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import { eq } from "drizzle-orm";
import { BN } from "bn.js";
type BNInstance = InstanceType<typeof BN>;
import type { Db } from "../db";
import { settlementEvidence } from "../../shared/schema";
import { RainfallConsensusService, type ConsensusResult } from "./consensus";
import { NOAA_STATIONS, type SkyHedgeCity } from "./noaa";
import { DATA_GRACE_SECONDS } from "./settlement-constants";

const PROGRAM_ID = process.env.SKYHEDGE_PROGRAM_ID ?? "7thTyPBaVCEBL2z28ojTxfmrbNMydXV3EAgbYgrz7GKr";
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const SETTLEMENT_KEYPAIR_ENV = process.env.SETTLEMENT_AUTHORITY_KEYPAIR;

interface MarketState { address: string; marketId: number; status: string; result: string; observationStart: number; observationEnd: number; dataDeadline: number; cityHash: string; }

/**
 * SettlementRunner: drives AWAITING_SETTLEMENT markets through deterministic
 * NOAA/WXM consensus → submit_weather_observation + settle_market, or
 * mark_data_unavailable after the data deadline. Idempotent: every action
 * re-checks on-chain status first. Never synthesizes weather values.
 */
export class SettlementRunner {
  private readonly connection = new Connection(RPC_URL, "confirmed");
  private readonly program: Program;
  private readonly programId = new PublicKey(PROGRAM_ID);
  private readonly consensus = new RainfallConsensusService();
  private running = false;

  constructor(private readonly db: Db, settlementKeypairPath?: string) {
    const idl = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "shared/idl/skyhedge_protection.json"), "utf8")) as Idl;
    const authority = loadSettlementKeypair(settlementKeypairPath);
    const provider = new AnchorProvider(this.connection, authority as never, { commitment: "confirmed" });
    this.program = new Program(idl, provider);
  }

  start(intervalMs = 60_000): () => void {
    const run = () => { void this.runOnce().catch((error) => console.error("[settlement] run failed:", error)); };
    void run();
    const timer = setInterval(run, intervalMs);
    return () => clearInterval(timer);
  }

  async runOnce(): Promise<{ scanned: number; settled: string[]; markedUnavailable: string[]; pending: string[] }> {
    if (this.running) return { scanned: 0, settled: [], markedUnavailable: [], pending: [] };
    this.running = true;
    try {
      const protocolAddress = PublicKey.findProgramAddressSync([Buffer.from("protocol")], this.programId)[0];
      const accounts = this.program.account as unknown as Record<string, { fetch: (address: PublicKey) => Promise<Record<string, unknown>> }>;
      const protocol = (await accounts["protocolConfig"].fetch(protocolAddress)) as unknown as { nextMarketId: BNInstance };
      const settled: string[] = [];
      const markedUnavailable: string[] = [];
      const pending: string[] = [];

      for (let id = 0n; id < BigInt(protocol.nextMarketId.toString()); id++) {
        const [marketAddress] = PublicKey.findProgramAddressSync([Buffer.from("market"), protocolAddress.toBuffer(), toLeBytes(id)], this.programId);
        const market = (await accounts["market"].fetch(marketAddress)) as unknown as { status: unknown; dataDeadline: BNInstance; observationStart: BNInstance; observationEnd: BNInstance; cityHash: number[] };
        if (JSON.stringify(market.status) !== JSON.stringify({ awaitingSettlement: {} })) continue;
        const now = Math.floor(Date.now() / 1000);

        if (now > market.dataDeadline.toNumber()) {
          const evidence = await this.deadlineEvidence(marketAddress.toBase58());
          const sourceHash = evidence.sourceHash;
          await this.program.methods.markDataUnavailable(sourceHashBytes(sourceHash)).accounts({ authority: this.authority().publicKey, market: marketAddress }).rpc();
          await this.persistEvidence(evidence, marketAddress.toBase58(), "DATA_UNAVAILABLE");
          markedUnavailable.push(marketAddress.toBase58());
          console.log(`[settlement] market ${marketAddress.toBase58()} marked DATA_UNAVAILABLE (deadline passed)`);
          continue;
        }

        const city = this.cityForHash(Buffer.from(market.cityHash).toString("hex"));
        if (!city) { pending.push(marketAddress.toBase58()); continue; }
        const windowStart = new Date(market.observationStart.toNumber() * 1000).toISOString().slice(0, 10);
        const windowEnd = new Date(market.observationEnd.toNumber() * 1000).toISOString().slice(0, 10);

        let result: ConsensusResult;
        try {
          result = await this.consensus.evidenceFor(city, windowStart, windowEnd);
        } catch {
          pending.push(marketAddress.toBase58());
          continue;
        }
        if (result.verdict !== "AGREED") { pending.push(marketAddress.toBase58()); continue; }

        const valueMmX100 = Math.round(result.finalValueMm! * 100);
        await this.program.methods
          .submitWeatherObservation({ cumulativeRainfallMmX100: new BN(valueMmX100), observedAt: new BN(market.observationEnd.toNumber()), sourceHash: sourceHashBytes(result.evidence.sourceHash) })
          .accounts({ authority: this.authority().publicKey, market: marketAddress })
          .rpc();
        await this.program.methods.settleMarket().accounts({ market: marketAddress }).rpc();
        await this.persistEvidence(result.evidence, marketAddress.toBase58(), "AGREED");
        settled.push(marketAddress.toBase58());
        console.log(`[settlement] market ${marketAddress.toBase58()} settled with ${valueMmX100 / 100}mm (${city})`);
      }
      return { scanned: Number(protocol.nextMarketId), settled, markedUnavailable, pending };
    } finally {
      this.running = false;
    }
  }

  private authority(): Keypair {
    return loadSettlementKeypair(SETTLEMENT_KEYPAIR_ENV);
  }

  private async deadlineEvidence(marketAddress: string): Promise<ConsensusResult["evidence"]> {
    const generatedAt = new Date().toISOString();
    const evidence = { methodologyVersion: "methodology-v1", city: "unknown", windowStart: "", windowEnd: "", noaa: { stationId: "", cumulativeMm: 0, records: [] }, wxm: { cumulativeMm: null, stations: [], perStationMm: [] }, deltaMm: null, toleranceMm: null, verdict: "DATA_UNAVAILABLE" as const, rule: "data deadline exceeded", sourceHash: "", generatedAt };
    evidence.sourceHash = canonicalHash({ marketAddress, reason: "data_deadline_exceeded", generatedAt });
    return evidence;
  }

  private async persistEvidence(evidence: ConsensusResult["evidence"], marketAddress: string, verdict: string): Promise<void> {
    await this.db.insert(settlementEvidence).values({
      sourceHash: evidence.sourceHash,
      marketAddress,
      city: evidence.city,
      windowStart: evidence.windowStart,
      windowEnd: evidence.windowEnd,
      methodologyVersion: evidence.methodologyVersion,
      verdict,
      noaaMm: String(evidence.noaa.cumulativeMm),
      wxmMm: evidence.wxm.cumulativeMm === null ? null : String(evidence.wxm.cumulativeMm),
      deltaMm: evidence.deltaMm === null ? null : String(evidence.deltaMm),
      toleranceMm: evidence.toleranceMm === null ? null : String(evidence.toleranceMm),
      evidence,
    }).onConflictDoNothing();
  }

  private cityForHash(hash: string): SkyHedgeCity | null {
    for (const city of Object.keys(NOAA_STATIONS) as SkyHedgeCity[]) {
      if (createHash("sha256").update(city).digest("hex") === hash) return city;
    }
    return null;
  }
}

export function loadSettlementKeypair(envPath?: string): Keypair {
  const resolved = envPath ? (path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath)) : path.resolve(process.cwd(), "anchor/keys/settlement-authority.json");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(resolved, "utf8")) as number[]));
}

export function sourceHashBytes(hash: string): number[] {
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