import { Buffer } from "buffer";
import { PublicKey } from "@solana/web3.js";
import { consumerCityName } from "../../shared/consumer-cities.ts";
import { DEVNET_RPC_URLS, devnetConnection, tryDevnetUrls } from "./chain.ts";
import { shortUtcDate, trimMm } from "./ticket.ts";

export const SKYHEDGE_PROGRAM_ID = new PublicKey("5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx");
export const POSITION_DATA_SIZE = 106;
export const POSITION_OWNER_OFFSET = 40;
const POSITION_DISC = Buffer.from([157, 171, 49, 175, 119, 109, 126, 129]);
const PROTOCOL_NEXT_MARKET_ID = 200;
const MAX_MARKETS = 64;

const CITY_HASHES: Record<string, string> = {
  "572990d52a3b8c590c8c62555f04b89e58733f5b0d5616605fe782e6cc6776db": "new-york",
  a2470c9d137c1c5d3567d1180a64cb43a9269c4d6f1ff13ac8cdbaf6fc5df3b7: "chicago",
  c55ec4bbe9c7c1614204f286194b109010ca0680f41325ec1a82302a34b4f3f7: "miami",
  fa2115f8d576a6ab722956697fc759c31d1cd6b93c8336bfebf73ed5cba2ff49: "dallas",
  "7d312c3425ddb796b057b9f5b9ee841a6bb779515740a897dfc3a2ccbc3c5d4d": "los-angeles",
  "3151a8f227c0e11fd9a7fd1aa24ebfee734503dea095c22c3b2fae09d62eeb25": "seattle",
  "3c66157844fa8ce7e9b67b0022383d7709ba2b30f8306d3c9b2eceb2cd91e4dc": "boston",
  c7c1319276e936c8d64f1d5ed80cd8a0cf54e6dea7b0125533eb4163e03a2c11: "austin",
  "13e27a0bebb4e79691313774caca41ef97af036a17240088665be784afbf8d32": "des-moines",
  "509c68e347a10ce4d57025c745d8acab6ff8d6d3d3680b2a9127957d25f464aa": "des-moines",
};

const OPERATORS = ["gt", "gte", "lt", "lte"] as const;
const MARKET_STATUSES = ["Draft", "Open", "Locked", "AwaitingSettlement", "Settled", "DataUnavailable", "Closed", "Cancelled"] as const;
const SETTLEMENT_RESULTS = ["Unset", "Triggered", "NotTriggered", "DataUnavailable"] as const;

export type ChainProtection = {
  market: string;
  address: string;
  protectedAmount: string;
  premiumPaid: string;
  potentialPayout: string;
  city: string;
  windowLabel: string;
  triggerLabel: string;
  statusLabel: string;
  openedAt: number;
  explorerUrl: string;
};

type AccountRow = { pubkey: PublicKey; data: Buffer };
type ReadDeps = {
  urls?: string[];
  attempts?: number;
  timeoutMs?: number;
  programId?: PublicKey;
  getProgramAccounts?: (url: string, owner: string) => Promise<AccountRow[]>;
  getMultipleAccounts?: (url: string, keys: PublicKey[]) => Promise<Array<Buffer | null>>;
  getAccount?: (url: string, key: PublicKey) => Promise<Buffer | null>;
};

export function positionAccountFilters(owner: string): Array<{ dataSize: number } | { memcmp: { offset: number; bytes: string } }> {
  return [
    { dataSize: POSITION_DATA_SIZE },
    { memcmp: { offset: POSITION_OWNER_OFFSET, bytes: new PublicKey(owner).toBase58() } },
  ];
}

export function decodePosition(data: Buffer): { market: string; owner: string; protectedAmount: string; premiumPaid: string; potentialPayout: string; openedAt: number; payoutClaimed: boolean; refundClaimed: boolean } | null {
  if (data.length < POSITION_DATA_SIZE || !bytesEqual(data, 0, POSITION_DISC)) return null;
  return {
    market: new PublicKey(data.subarray(8, 40)).toBase58(),
    owner: new PublicKey(data.subarray(40, 72)).toBase58(),
    protectedAmount: readU64LE(data, 72).toString(),
    premiumPaid: readU64LE(data, 80).toString(),
    potentialPayout: readU64LE(data, 88).toString(),
    openedAt: Number(readI64LE(data, 96)),
    payoutClaimed: data[104] === 1,
    refundClaimed: data[105] === 1,
  };
}

export function protectionView(address: string, positionData: Buffer, marketData: Buffer | null): ChainProtection | null {
  const position = decodePosition(positionData);
  if (!position) return null;
  const market = decodeMarket(marketData);
  const citySlug = market ? CITY_HASHES[market.cityHash] : undefined;
  return {
    market: position.market,
    address,
    protectedAmount: position.protectedAmount,
    premiumPaid: position.premiumPaid,
    potentialPayout: position.potentialPayout,
    city: citySlug ? consumerCityName(citySlug) : "Unknown city",
    windowLabel: market ? windowLabel(market.observationStart, market.observationEnd) : "—",
    triggerLabel: market ? triggerLabel(market.operator, market.thresholdMmX100) : "—",
    statusLabel: statusLabel(position, market),
    openedAt: position.openedAt,
    explorerUrl: `https://explorer.solana.com/address/${address}?cluster=devnet`,
  };
}

/** Finalized position accounts for this owner. Program scan first, then PDA derivation. */
export async function readFinalizedProtections(wallet: string, deps: ReadDeps = {}): Promise<ChainProtection[]> {
  const owner = new PublicKey(wallet).toBase58();
  const opts = { urls: deps.urls ?? DEVNET_RPC_URLS, attempts: deps.attempts ?? 2, timeoutMs: deps.timeoutMs ?? 8_000 };
  let rows: AccountRow[];
  try {
    rows = await tryDevnetUrls((url) => (deps.getProgramAccounts ?? defaultProgramAccounts)(url, owner), opts);
  } catch (gpaError) {
    try {
      rows = await tryDevnetUrls((url) => derivePositions(url, owner, deps), opts);
    } catch (pdaError) {
      const first = gpaError instanceof Error ? gpaError.message : "program account scan failed";
      const second = pdaError instanceof Error ? pdaError.message : "PDA scan failed";
      throw new Error(`Could not read protections from Solana. ${first} ${second}`);
    }
  }
  const decoded = rows.flatMap((row) => {
    const data = Buffer.from(row.data);
    return decodePosition(data) ? [{ pubkey: row.pubkey, data }] : [];
  });
  if (!decoded.length) return [];
  const marketKeys = [...new Map(decoded.map((row) => {
    const market = new PublicKey(decodePosition(row.data)!.market);
    return [market.toBase58(), market] as const;
  })).values()];
  const markets = await tryDevnetUrls((url) => (deps.getMultipleAccounts ?? defaultMultiple)(url, marketKeys), opts);
  const byMarket = new Map(marketKeys.map((key, index) => [key.toBase58(), markets[index] ? Buffer.from(markets[index]!) : null]));
  return decoded
    .flatMap((row) => {
      const view = protectionView(row.pubkey.toBase58(), row.data, byMarket.get(decodePosition(row.data)!.market) ?? null);
      return view ? [view] : [];
    })
    .sort((left, right) => right.openedAt - left.openedAt);
}

function decodeMarket(data: Buffer | null): { cityHash: string; operator: (typeof OPERATORS)[number]; thresholdMmX100: string; observationStart: number; observationEnd: number; status: (typeof MARKET_STATUSES)[number]; result: (typeof SETTLEMENT_RESULTS)[number] } | null {
  if (!data || data.length < 383) return null;
  const operator = OPERATORS[data[240]];
  const status = MARKET_STATUSES[data[381]];
  const result = SETTLEMENT_RESULTS[data[382]];
  if (!operator || !status || !result) return null;
  return {
    cityHash: hexBytes(data, 80, 32),
    operator,
    thresholdMmX100: readI64LE(data, 241).toString(),
    observationStart: Number(readI64LE(data, 257)),
    observationEnd: Number(readI64LE(data, 265)),
    status,
    result,
  };
}

function windowLabel(start: number, end: number): string {
  const from = shortUtcDate(start);
  const to = shortUtcDate(end > 0 ? end - 1 : null);
  return from && to ? `${from} – ${to}` : "—";
}

function triggerLabel(operator: (typeof OPERATORS)[number], threshold: string): string {
  if (!/^-?\d+$/.test(threshold)) return "—";
  const symbol = operator === "gt" ? ">" : operator === "lt" ? "<" : operator === "lte" ? "≤" : "≥";
  return `${symbol} ${trimMm(Number(threshold) / 100)} mm`;
}

function statusLabel(position: { payoutClaimed: boolean; refundClaimed: boolean }, market: ReturnType<typeof decodeMarket>): string {
  if (position.payoutClaimed) return "Claimed";
  if (position.refundClaimed) return "Refunded";
  if (!market || market.status === "Open") return "Active";
  if (market.status === "Locked" || market.status === "AwaitingSettlement") return "Watching";
  if (market.status === "Settled" && market.result === "Triggered") return "Payout ready";
  if (market.status === "Settled") return "Settled";
  if (market.status === "DataUnavailable") return "Refund ready";
  return market.status;
}

function hexBytes(data: Buffer, offset: number, length: number): string {
  let hex = "";
  for (let index = 0; index < length; index++) {
    hex += data[offset + index]!.toString(16).padStart(2, "0");
  }
  return hex;
}

function bytesEqual(data: Buffer, offset: number, expected: Buffer): boolean {
  for (let index = 0; index < expected.length; index++) {
    if (data[offset + index] !== expected[index]) return false;
  }
  return true;
}

/** Hermes' Buffer build has no readBigUInt64LE. Two uint32 reads stay compatible. */
function readU64LE(data: Buffer, offset: number): bigint {
  const low = BigInt(data.readUInt32LE(offset));
  const high = BigInt(data.readUInt32LE(offset + 4));
  return low + (high << 32n);
}

function readI64LE(data: Buffer, offset: number): bigint {
  const value = readU64LE(data, offset);
  return value >= 0x8000000000000000n ? value - 0x10000000000000000n : value;
}

async function defaultProgramAccounts(url: string, owner: string): Promise<AccountRow[]> {
  const rows = await devnetConnection(url, "finalized").getProgramAccounts(SKYHEDGE_PROGRAM_ID, {
    commitment: "finalized",
    filters: positionAccountFilters(owner),
  });
  return rows.map((row) => ({ pubkey: row.pubkey, data: Buffer.from(row.account.data) }));
}

async function defaultMultiple(url: string, keys: PublicKey[]): Promise<Array<Buffer | null>> {
  if (!keys.length) return [];
  const rows = await devnetConnection(url, "finalized").getMultipleAccountsInfo(keys, "finalized");
  return rows.map((row) => row ? Buffer.from(row.data) : null);
}

async function defaultAccount(url: string, key: PublicKey): Promise<Buffer | null> {
  const row = await devnetConnection(url, "finalized").getAccountInfo(key, "finalized");
  return row ? Buffer.from(row.data) : null;
}

async function derivePositions(url: string, owner: string, deps: ReadDeps): Promise<AccountRow[]> {
  const programId = deps.programId ?? SKYHEDGE_PROGRAM_ID;
  const [protocol] = PublicKey.findProgramAddressSync([Buffer.from("protocol")], programId);
  const protocolData = await (deps.getAccount ?? defaultAccount)(url, protocol);
  if (!protocolData || protocolData.length < PROTOCOL_NEXT_MARKET_ID + 8) throw new Error("Protocol account is unavailable.");
  const next = readU64LE(protocolData, PROTOCOL_NEXT_MARKET_ID);
  if (next > BigInt(MAX_MARKETS)) throw new Error("Market list is too large to scan directly.");
  const marketKeys: PublicKey[] = [];
  for (let id = 0n; id < next; id++) {
    const encoded = Buffer.alloc(8);
    encoded.writeBigUInt64LE(id);
    marketKeys.push(PublicKey.findProgramAddressSync([Buffer.from("market"), protocol.toBuffer(), encoded], programId)[0]);
  }
  const multiple = deps.getMultipleAccounts ?? defaultMultiple;
  const markets = marketKeys.length ? await multiple(url, marketKeys) : [];
  const live = marketKeys.filter((_, index) => markets[index]);
  const ownerKey = new PublicKey(owner);
  const positionKeys = live.map((market) => PublicKey.findProgramAddressSync([Buffer.from("position"), market.toBuffer(), ownerKey.toBuffer()], programId)[0]);
  const positions = positionKeys.length ? await multiple(url, positionKeys) : [];
  return positionKeys.flatMap((pubkey, index) => positions[index] ? [{ pubkey, data: Buffer.from(positions[index]!) }] : []);
}
