import { Connection, PublicKey } from "@solana/web3.js";
import { BorshCoder, EventParser, type Idl } from "@coral-xyz/anchor";
import * as fs from "node:fs";
import * as path from "node:path";
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { chainEvents, indexedSlots, liquidityPositions, markets, protectionPositions, settlementObservations } from "../../shared/schema";

const PROGRAM_ID = process.env.SKYHEDGE_PROGRAM_ID ?? "7thTyPBaVCEBL2z28ojTxfmrbNMydXV3EAgbYgrz7GKr";
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const NETWORK = process.env.SOLANA_NETWORK ?? "devnet";

interface IndexedEvent { signature: string; slot: bigint; eventType: string; payload: Record<string, unknown>; finalizedAt: Date; }

type BigIntAsString = bigint & { __serialized: never };
function BIGINT(value: bigint): BigIntAsString { return value.toString() as unknown as BigIntAsString; }

/**
 * Finalized-slot Anchor indexer: scans the program's transaction history at finalized
 * commitment, decodes accounts and events with the committed IDL, and upserts into Neon.
 * The UI/API never sees simulated portfolio state.
 */
export class AnchorIndexer {
  private readonly connection = new Connection(RPC_URL, "confirmed");
  private readonly coder: BorshCoder;
  private readonly programId = new PublicKey(PROGRAM_ID);

  private readonly accountNames: string[];

  constructor(private readonly db: Db) {
    const idl = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "shared/idl/skyhedge_protection.json"), "utf8")) as Idl;
    this.coder = new BorshCoder(idl);
    this.accountNames = (idl.accounts ?? []).map((account) => account.name);
  }

  async reconcile(): Promise<{ toSlot: bigint; events: number; accounts: number }> {
    const toSlot = BigInt(await this.connection.getSlot("finalized"));
    const checkpoint = await this.db.select().from(indexedSlots).where(eq(indexedSlots.network, NETWORK)).limit(1);
    const checkpointSlot = checkpoint.length ? BigInt(checkpoint[0].slot) : toSlot - 2_000n;

    const signatures: Awaited<ReturnType<Connection["getSignaturesForAddress"]>> = [];
    let cursor: string | undefined;
    for (let page = 0; page < 20; page++) {
      const pageSigs = await this.connection.getSignaturesForAddress(this.programId, cursor ? { before: cursor } : {}, "finalized");
      if (!pageSigs.length) break;
      signatures.push(...pageSigs);
      if (BigInt(pageSigs[pageSigs.length - 1].slot) <= checkpointSlot) break;
      cursor = pageSigs[pageSigs.length - 1].signature;
    }

    const { events, accounts } = await this.processSignatures(signatures);

    await Promise.all(events.map((event) => this.db.insert(chainEvents).values({ ...event, slot: BIGINT(event.slot) }).onConflictDoNothing()));
    await this.db.insert(indexedSlots).values({ network: NETWORK, slot: BIGINT(toSlot) }).onConflictDoUpdate({ target: indexedSlots.network, set: { slot: BIGINT(toSlot), updatedAt: new Date() } });
    return { toSlot, events: events.length, accounts };
  }

  private async processSignatures(infos: Awaited<ReturnType<Connection["getSignaturesForAddress"]>>): Promise<{ events: IndexedEvent[]; accounts: number }> {
    const events: IndexedEvent[] = [];
    const parser = new EventParser(this.programId, this.coder);
    const programAccounts = new Set<string>();
    let accounts = 0;

    for (const info of infos) {
      const tx = await this.connection.getTransaction(info.signature, { commitment: "finalized", maxSupportedTransactionVersion: 0 });
      if (!tx || !tx.meta) continue;
      for (const parsed of parser.parseLogs(tx.meta.logMessages ?? [])) {
        events.push({ signature: info.signature, slot: BigInt(info.slot), eventType: parsed.name, payload: flattenEvent(parsed.data as Record<string, unknown>), finalizedAt: new Date((info.blockTime ?? Math.floor(Date.now() / 1000)) * 1000) });
      }
      for (const key of tx.transaction.message.staticAccountKeys) {
        if (programAccounts.has(key.toBase58())) continue;
        const info = await this.connection.getAccountInfo(key, "finalized");
        if (info && info.owner.equals(this.programId) && info.data.length >= 8) {
          programAccounts.add(key.toBase58());
          const decoded = this.decodeAccount(key, info.data);
          if (decoded) { await this.upsertAccount(decoded); accounts++; }
        }
      }
    }
    return { events, accounts };
  }

  private decodeAccount(address: PublicKey, data: Uint8Array): { name: string; address: PublicKey; raw: Record<string, unknown>; flat: Record<string, unknown> } | null {
    const discriminator = data.slice(0, 8);
    for (const name of this.accountNames) {
      if (this.coder.accounts.accountDiscriminator(name).equals(Buffer.from(discriminator))) {
        try {
          const decoded = this.coder.accounts.decode(name, Buffer.from(data)) as Record<string, unknown>;
          return { name: name.charAt(0).toLowerCase() + name.slice(1), address, raw: decoded, flat: flattenEvent(decoded) };
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  private async upsertAccount(account: { name: string; address: PublicKey; raw: Record<string, unknown>; flat: Record<string, unknown> }): Promise<void> {
    const address = account.address.toBase58();
    const state = account.flat;
    const raw = account.raw;
    const slot = 0n;
    const updatedAt = new Date();
    switch (account.name) {
      case "market": {
        const marketId = state.id ? BigInt(String(state.id)) : 0n;
        await this.db.insert(markets).values({ address, marketId: BIGINT(marketId), city: "unknown", stationId: "unknown", state: "unknown", metadata: raw, finalizedSlot: BIGINT(slot), updatedAt }).onConflictDoUpdate({ target: markets.address, set: { metadata: raw, updatedAt } });
        break;
      }
      case "liquidityPosition": {
        const marketAddress = state.market ? String((state.market as unknown as { toString(): string }).toString()) : "";
        const provider = state.provider ? String((state.provider as unknown as { toString(): string }).toString()) : "";
        const shares = state.shares ? BigInt(String(state.shares)) : 0n;
        await this.db.insert(liquidityPositions).values({ address, marketAddress, provider, shares: BIGINT(shares), state, finalizedSlot: BIGINT(slot) }).onConflictDoUpdate({ target: liquidityPositions.address, set: { shares: BIGINT(shares), state } });
        break;
      }
      case "protectionPosition": {
        const marketAddress = state.market ? String((state.market as unknown as { toString(): string }).toString()) : "";
        const owner = state.owner ? String((state.owner as unknown as { toString(): string }).toString()) : "";
        const protectedAmount = (state as Record<string, unknown>).protected_amount ?? state.protectedAmount;
        const premiumPaid = (state as Record<string, unknown>).premium_paid ?? state.premiumPaid;
        const protectedAmountBig = protectedAmount ? BigInt(String(protectedAmount)) : 0n;
        const premiumPaidBig = premiumPaid ? BigInt(String(premiumPaid)) : 0n;
        await this.db.insert(protectionPositions).values({ address, marketAddress, owner, protectedAmount: BIGINT(protectedAmountBig), premiumPaid: BIGINT(premiumPaidBig), state, finalizedSlot: BIGINT(slot) }).onConflictDoUpdate({ target: protectionPositions.address, set: { protectedAmount: BIGINT(protectedAmountBig), premiumPaid: BIGINT(premiumPaidBig), state } });
        break;
      }
      case "settlementObservation": {
        const marketAddress = state.market ? String((state.market as unknown as { toString(): string }).toString()) : "";
        const authority = state.authority ? String((state.authority as unknown as { toString(): string }).toString()) : "";
        const sourceHash = (state as Record<string, unknown>).source_hash ?? state.sourceHash;
        const sourceHashHex = sourceHash ? String(Array.isArray(sourceHash) ? sourceHash.map((byte) => byte.toString(16).padStart(2, "0")).join("") : sourceHash) : "";
        const valueMmX100 = (state as Record<string, unknown>).cumulative_rainfall_mm_x100 ?? state.cumulativeRainfallMmX100;
        const valueMmX100Big = valueMmX100 ? BigInt(String(valueMmX100)) : 0n;
        await this.db.insert(settlementObservations).values({ marketAddress, authority, sourceHash: sourceHashHex, valueMmX100: BIGINT(valueMmX100Big), finalizedSlot: BIGINT(slot) }).onConflictDoUpdate({ target: settlementObservations.marketAddress, set: { sourceHash: sourceHashHex, valueMmX100: BIGINT(valueMmX100Big) } });
        break;
      }
    }
  }
}

function flattenEvent(data: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) flat[key] = value;
    else if (typeof value === "object" && "bn" in (value as object)) flat[key] = String((value as { bn: unknown }).bn ?? value);
    else if (typeof value === "object" && "toString" in (value as object)) flat[key] = String((value as { toString(): string }).toString());
    else if (typeof value === "object") flat[key] = flattenEvent(value as Record<string, unknown>);
    else flat[key] = value;
  }
  return flat;
}