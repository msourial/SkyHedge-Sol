import { Buffer } from "buffer";
import { PublicKey, type AccountInfo } from "@solana/web3.js";
import { LIVE_CITY_SLUGS, tenorOf, type LiveCitySlug } from "../../shared/window-ladder.ts";
import type { DevnetStatus } from "./api.ts";
import { SKYT_MINT, devnetConnection, tryDevnetUrls } from "./chain.ts";
import { SKYHEDGE_PROGRAM_ID } from "./positions.ts";
import { hexBytes, readI64LE, readU16LE, readU64LE, sliceBytes, u64LeBytes } from "./bytes.ts";
import { marketIdentity } from "../../shared/ui-market-identity.ts";
import type { PerilId } from "../../shared/ui-types.ts";

/**
 * Committed hashes, identical to the server's: sha256(slug) for city_hash, and
 * canonicalSourceHash() (sha256 of JSON.stringify) for station, provider and methodology.
 * chain-status.test.ts recomputes every value from shared/methodology-v1.json and the NOAA station IDs.
 */
export const CITY_HASHES: Record<LiveCitySlug, string> = {
  "new-york": "572990d52a3b8c590c8c62555f04b89e58733f5b0d5616605fe782e6cc6776db",
  chicago: "a2470c9d137c1c5d3567d1180a64cb43a9269c4d6f1ff13ac8cdbaf6fc5df3b7",
  miami: "c55ec4bbe9c7c1614204f286194b109010ca0680f41325ec1a82302a34b4f3f7",
  dallas: "fa2115f8d576a6ab722956697fc759c31d1cd6b93c8336bfebf73ed5cba2ff49",
  "los-angeles": "7d312c3425ddb796b057b9f5b9ee841a6bb779515740a897dfc3a2ccbc3c5d4d",
  seattle: "3151a8f227c0e11fd9a7fd1aa24ebfee734503dea095c22c3b2fae09d62eeb25",
  boston: "3c66157844fa8ce7e9b67b0022383d7709ba2b30f8306d3c9b2eceb2cd91e4dc",
  austin: "c7c1319276e936c8d64f1d5ed80cd8a0cf54e6dea7b0125533eb4163e03a2c11",
  "des-moines": "13e27a0bebb4e79691313774caca41ef97af036a17240088665be784afbf8d32",
};
/** Early Des Moines markets hashed the title instead of the slug. */
export const DES_MOINES_TITLE_HASH = "509c68e347a10ce4d57025c745d8acab6ff8d6d3d3680b2a9127957d25f464aa";
export const NOAA_STATION_IDS: Record<LiveCitySlug, string> = {
  "new-york": "GHCND:USW00094728", chicago: "GHCND:USW00094846", miami: "GHCND:USW00012839", dallas: "GHCND:USW00003927",
  "los-angeles": "GHCND:USW00023174", seattle: "GHCND:USW00024233", boston: "GHCND:USW00014739", austin: "GHCND:USW00013904", "des-moines": "GHCND:USW00014933",
};
export const STATION_ID_HASHES: Record<LiveCitySlug, string> = {
  "new-york": "ee159487252885833b6e05da589ca4b6903c7755c11201def10bc6f8d86d8426",
  chicago: "45aa3293795bdbee9a55cea27e052b834b25c468ca6b8054771414a4d70ce867",
  miami: "d31487a114c6141965de91dbb39f33576dfdaa9e78c4105fd1e9ae61a3dcf6b2",
  dallas: "f88bcb7cd96db0e35ecd0c2652d16ca47a77f63730d00d5266ea3c1d92d44fc0",
  "los-angeles": "9b19f6ee22e865cf5f0fcfc3e43dd73b9a17c124a09b10634092c4009663616b",
  seattle: "08605eab449039a1a23754a851a32b7d8a5164f3cc1a665a1ba5996e48d9c943",
  boston: "80c2054ab6a3488a4d8d982a8306e734d8a3f10000f3c9ac26158b6d144c3b81",
  austin: "3d80498fa6a42e05277158810ac2d0fb62249de5d3dba0eed77461ea0d8de466",
  "des-moines": "81a9c5ec3a63c14e787aafca8a0ae85b96f30f9258d444a827b948da3d941b5d",
};
export const PROVIDER_HASH = "6a8353f65dae69e90e4e142d1e5bbdeff295d5a1b3c8e18e059a590463050707";
export const METHODOLOGY_HASH = "b368d68c08eaea56b0b2abf569f41b00dd9536b891a7ac4287c6f6401faefd10";
/**
 * Pinned provider/methodology hashes for every open peril (server/services/methodology-docs.ts).
 * Rain keeps the original methodology-v1 pair above.
 */
export type ChainPerilId = Exclude<PerilId, "cold">;
export const PERIL_EVIDENCE_HASHES: Record<ChainPerilId, { providerHash: string; methodologyHash: string }> = {
  rain: { providerHash: PROVIDER_HASH, methodologyHash: METHODOLOGY_HASH },
  snow: { providerHash: "dc297e3ebd3aba397702c957ec5d272a0e4fe22f0b4845184e6caa426e44e6b1", methodologyHash: "696f98680f40971992baf0eea2275dd6ce35e6151a21904c9330936b362e7e55" },
  wind: { providerHash: "f09b7957b67591314a9c6d8493649792f1e27c5e303f9285b56e9c029ea0ea82", methodologyHash: "dc2b246ae1551ab5e1ff4dacdc3497cbebdcc8c062f7f77b2ce8458fc0ac1dfd" },
  heat: { providerHash: "25633f4d5b0e5e0f9860a11bdd024ee704b3822410ccdb702e97e85fc9bbb217", methodologyHash: "ed56493eeb4793d91b8f3c8ae7179274a1cb9929d6082c7f971357691ace0e7c" },
};
/** Counts from shared/idl/skyhedge_protection.json (checked by the test). */
export const IDL_INSTRUCTION_COUNT = 22;
export const IDL_ACCOUNT_COUNT = 5;

const MARKET_DISCRIMINATOR = [219, 190, 213, 55, 0, 227, 198, 154];
const PROTOCOL_DISCRIMINATOR = [207, 91, 250, 28, 152, 179, 215, 209];
const MARKET_STATUSES = ["Draft", "Open", "Locked", "AwaitingSettlement", "Settled", "DataUnavailable", "Closed", "Cancelled"] as const;
const OPERATORS = ["gt", "gte", "lt", "lte"] as const;

type MarketWindow = NonNullable<DevnetStatus["cityWindows"]>[number];
export type DecodedMarket = {
  id: string; cityHash: string; stationIdHash: string; providerHash: string; methodologyHash: string; quoteInputsHash: string;
  operator: (typeof OPERATORS)[number] | null; thresholdMmX100: string; salesCloseAt: number; observationStart: number; observationEnd: number;
  quoteProbabilityBps: number; premiumRateBps: number; status: string | null;
};

function hasDiscriminator(data: Uint8Array, expected: number[]): boolean {
  return data.length >= 8 && expected.every((byte, index) => data[index] === byte);
}

/** Borsh layout of the committed IDL's Market account (fixed-size prefix through `status`). */
export function decodeMarket(data: Uint8Array): DecodedMarket | null {
  const buf = data;
  if (!hasDiscriminator(buf, MARKET_DISCRIMINATOR) || buf.length < 383) return null;
  const hex = (offset: number) => hexBytes(buf, offset, 32);
  const i64 = (offset: number) => Number(readI64LE(buf, offset));
  return {
    id: readU64LE(buf, 8).toString(),
    cityHash: hex(80), stationIdHash: hex(112), providerHash: hex(144), methodologyHash: hex(176), quoteInputsHash: hex(208),
    operator: OPERATORS[buf[240]!] ?? null,
    thresholdMmX100: readI64LE(buf, 241).toString(),
    salesCloseAt: i64(249), observationStart: i64(257), observationEnd: i64(265),
    quoteProbabilityBps: readU16LE(buf, 289), premiumRateBps: readU16LE(buf, 291),
    status: MARKET_STATUSES[buf[381]!] ?? null,
  };
}

export function decodeProtocol(data: Uint8Array): { admin: string; settlementAuthority: string; collateralMint: string; nextMarketId: bigint } | null {
  const buf = data;
  if (!hasDiscriminator(buf, PROTOCOL_DISCRIMINATOR) || buf.length < 208) return null;
  const key = (offset: number) => new PublicKey(sliceBytes(buf, offset, 32)).toBase58();
  return { admin: key(8), settlementAuthority: key(72), collateralMint: key(136), nextMarketId: readU64LE(buf, 200) };
}

/** SPL token account amount (u64 at byte 64). */
export function tokenAccountAmount(data: Uint8Array | null | undefined): string | null {
  if (!data || data.length < 72) return null;
  return readU64LE(data, 64).toString();
}

export function slugForCityHash(hash: string): LiveCitySlug | null {
  return cityPerilForHash(hash)?.city ?? null;
}

/**
 * Same rule as the server's resolveCityPeril: rain is sha256(slug), other open perils are
 * sha256(`${slug}:${peril}`). A rain-only lookup silently drops every snow, wind and heat market.
 */
export function cityPerilForHash(hash: string): { city: LiveCitySlug; peril: ChainPerilId } | null {
  const lower = hash.toLowerCase();
  if (lower === DES_MOINES_TITLE_HASH) return { city: "des-moines", peril: "rain" };
  const identity = marketIdentity(lower);
  if (!identity || identity.peril === "cold" || !(LIVE_CITY_SLUGS as readonly string[]).includes(identity.cityId)) return null;
  return { city: identity.cityId as LiveCitySlug, peril: identity.peril };
}

/** Same rule as the server's hasPinnedStationEvidence: any open peril's pinned methodology pair. */
export function hasPinnedEvidence(market: DecodedMarket, slug: LiveCitySlug): boolean {
  return market.stationIdHash === STATION_ID_HASHES[slug]
    && Object.values(PERIL_EVIDENCE_HASHES).some((pair) => market.providerHash === pair.providerHash && market.methodologyHash === pair.methodologyHash)
    && /^[0-9a-f]{64}$/.test(market.quoteInputsHash) && !/^0{64}$/.test(market.quoteInputsHash);
}

export type ListedMarket = MarketWindow & { slug: LiveCitySlug; peril: ChainPerilId; id: bigint; cityHash: string; rawStatus: string | null };

/** Same selling rule as the server's sellingWindow(). */
export function isSelling(market: ListedMarket, nowSeconds: number): boolean {
  if (!tenorOf(market.observationStart, market.observationEnd)) return false;
  if (market.rawStatus !== "Open" || market.evidenceStatus !== "validated") return false;
  if (market.quoteProbabilityBps == null || market.premiumRateBps == null || !market.quoteInputsHash) return false;
  if (!market.salesCloseAt || market.salesCloseAt <= nowSeconds) return false;
  return !!market.vaultBalance && /^\d+$/.test(market.vaultBalance) && BigInt(market.vaultBalance) > 0n;
}

type MultiReader = (keys: PublicKey[]) => Promise<(AccountInfo<Buffer> | null)[]>;

/** Read the program, protocol, every market and its vault in four batched calls. */
export async function readDevnetStatusFrom(read: MultiReader, nowSeconds = Math.floor(Date.now() / 1_000)): Promise<DevnetStatus> {
  const programId = SKYHEDGE_PROGRAM_ID;
  const mint = new PublicKey(SKYT_MINT);
  const [protocolAddress] = PublicKey.findProgramAddressSync([Buffer.from("protocol")], programId);
  const [feeVaultAddress] = PublicKey.findProgramAddressSync([Buffer.from("fee-vault"), protocolAddress.toBuffer()], programId);
  const [programInfo, mintInfo, protocolInfo, feeVaultInfo] = await read([programId, mint, protocolAddress, feeVaultAddress]);
  const protocol = protocolInfo ? decodeProtocol(protocolInfo.data) : null;
  const mintData: Uint8Array | null = mintInfo ? mintInfo.data : null;
  const decimals = mintData && mintData.length >= 82 ? mintData[44]! : null;

  const markets: ListedMarket[] = [];
  const next = protocol?.nextMarketId ?? 0n;
  for (let start = 0n; start < next; start += 100n) {
    const ids: bigint[] = [];
    for (let id = start; id < next && id < start + 100n; id++) ids.push(id);
    const addresses = ids.map((id) => {
      return PublicKey.findProgramAddressSync([Buffer.from("market"), protocolAddress.toBuffer(), Buffer.from(u64LeBytes(id))], programId)[0];
    });
    const infos = await read(addresses);
    const found: Array<{ id: bigint; address: PublicKey; vault: PublicKey; decoded: DecodedMarket; slug: LiveCitySlug; peril: ChainPerilId }> = [];
    infos.forEach((info, index) => {
      const decoded = info ? decodeMarket(info.data) : null;
      const identity = decoded ? cityPerilForHash(decoded.cityHash) : null;
      if (!decoded || !identity) return;
      const address = addresses[index]!;
      const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), address.toBuffer()], programId);
      found.push({ id: ids[index]!, address, vault, decoded, slug: identity.city, peril: identity.peril });
    });
    const vaults = found.length ? await read(found.map((item) => item.vault)) : [];
    found.forEach((item, index) => {
      const d = item.decoded;
      markets.push({
        slug: item.slug, id: item.id, cityHash: d.cityHash, rawStatus: d.status,
        city: item.slug, peril: item.peril, tenor: tenorOf(d.observationStart, d.observationEnd) ?? "weekly", status: "ready",
        address: item.address.toBase58(), marketId: item.id.toString(), vault: item.vault.toBase58(),
        vaultBalance: tokenAccountAmount(vaults[index]?.data),
        onchainStatus: d.status ? JSON.stringify({ [d.status]: {} }) : null,
        salesCloseAt: d.salesCloseAt, observationStart: d.observationStart, observationEnd: d.observationEnd,
        thresholdMmX100: d.thresholdMmX100, operator: d.operator,
        quoteProbabilityBps: d.quoteProbabilityBps, premiumRateBps: d.premiumRateBps, quoteInputsHash: d.quoteInputsHash,
        evidenceStatus: hasPinnedEvidence(d, item.slug) ? "validated" : "researching_evidence",
      });
    });
  }

  const strip = ({ slug: _s, id: _i, cityHash: _c, rawStatus: _r, ...window }: ListedMarket): MarketWindow => window;
  const desMoines = markets.filter((m) => m.slug === "des-moines" && m.peril === "rain").sort((a, b) => (a.id > b.id ? -1 : 1))[0] ?? null;
  const state = (raw: string | null) => raw === "Draft" ? "draft" as const : raw === "Open" ? "open" as const : raw === "Cancelled" ? "cancelled" as const : "other" as const;
  return {
    network: "devnet",
    program: { address: programId.toBase58(), status: programInfo?.executable ? "ready" : "pending", executable: !!programInfo?.executable, explorerUrl: `https://explorer.solana.com/address/${programId.toBase58()}?cluster=devnet` },
    idl: { status: "ready", source: "local-committed-idl", instructionCount: IDL_INSTRUCTION_COUNT, accountCount: IDL_ACCOUNT_COUNT, supportsEmptyDraftCancellation: false },
    protocol: { address: protocolAddress.toBase58(), status: protocol ? "ready" : "pending", initialized: !!protocol, admin: protocol?.admin ?? null, settlementAuthority: protocol?.settlementAuthority ?? null, collateralMint: protocol?.collateralMint ?? null, nextMarketId: protocol ? protocol.nextMarketId.toString() : null },
    feeVault: { address: feeVaultAddress.toBase58(), status: feeVaultInfo ? "ready" : "pending", exists: !!feeVaultInfo, balance: tokenAccountAmount(feeVaultInfo?.data) },
    skytMint: { address: mint.toBase58(), status: mintInfo ? "ready" : "pending", exists: !!mintInfo, decimals, supply: mintData && mintData.length >= 82 ? readU64LE(mintData, 36).toString() : null, mintAuthority: mintData && mintData[0] === 1 && mintData[1] === 0 && mintData[2] === 0 && mintData[3] === 0 ? new PublicKey(sliceBytes(mintData, 4, 32)).toBase58() : null },
    desMoinesMarket: desMoines ? (({ city: _city, tenor: _tenor, peril: _peril, ...terms }) => ({ ...terms, targetCityHash: desMoines.cityHash }))(strip(desMoines)) : {
      status: "pending", address: null, marketId: null, vault: null, vaultBalance: null, onchainStatus: null, salesCloseAt: null, observationStart: null, observationEnd: null,
      thresholdMmX100: null, operator: null, quoteProbabilityBps: null, premiumRateBps: null, quoteInputsHash: null, evidenceStatus: "researching_evidence", targetCityHash: CITY_HASHES["des-moines"],
    },
    ladderMarkets: markets.map((m) => ({ city: m.slug, peril: m.peril, state: state(m.rawStatus), salesCloseAt: m.salesCloseAt })),
    cityWindows: markets.filter((m) => isSelling(m, nowSeconds)).map(strip).sort((a, b) => a.observationStart - b.observationStart),
    // NOAA evidence packages stay on the server; Protect reads them from the evidence route, which needs no RPC.
    noaaEvidence: { status: "unavailable", settlementSource: "NOAA", message: "Read directly from Devnet on this phone.", package: null },
    generatedAt: new Date(nowSeconds * 1_000).toISOString(),
  };
}

/** Phone-side status read with the same endpoint failover as the on-device transaction builder. */
export function readDevnetStatusOnDevice(): Promise<DevnetStatus> {
  return tryDevnetUrls(
    (url) => readDevnetStatusFrom((keys) => devnetConnection(url, "confirmed").getMultipleAccountsInfo(keys, "confirmed")),
    { attempts: 2, timeoutMs: 12_000 },
  );
}

/** Phone first, server as fallback; a failure shows both reasons. */
export async function loadDevnetStatus(deps: { onDevice: () => Promise<DevnetStatus>; server: () => Promise<DevnetStatus> }): Promise<DevnetStatus> {
  let deviceError: unknown;
  try { return await deps.onDevice(); } catch (error) { deviceError = error; }
  try { return await deps.server(); } catch (error) {
    const device = deviceError instanceof Error ? deviceError.message : String(deviceError);
    const server = error instanceof Error ? error.message : String(error);
    throw new Error(`Couldn't load prices. Phone Devnet RPC: ${device}. SkyHedge server: ${server}`);
  }
}
