import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { Buffer } from "buffer";
import { PublicKey } from "@solana/web3.js";
import { LIVE_CITY_SLUGS } from "../../shared/window-ladder.ts";
import { committedPremiumQuote } from "../../shared/market-pricing.ts";
import { payGet } from "../../shared/pay-get.ts";
import {
  CITY_HASHES, DES_MOINES_TITLE_HASH, IDL_ACCOUNT_COUNT, IDL_INSTRUCTION_COUNT, METHODOLOGY_HASH, NOAA_STATION_IDS, PROVIDER_HASH, STATION_ID_HASHES,
  decodeMarket, loadDevnetStatus, readDevnetStatusFrom,
} from "./chain-status.ts";
import { SKYT_MINT } from "./chain.ts";
import { SKYHEDGE_PROGRAM_ID } from "./positions.ts";

const root = new URL("../../", import.meta.url);
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const canonical = (value: unknown) => sha(JSON.stringify(value));
const methodology = JSON.parse(readFileSync(new URL("shared/methodology-v1.json", root), "utf8"));
const idl = JSON.parse(readFileSync(new URL("shared/idl/skyhedge_protection.json", root), "utf8"));
const noaaSource = readFileSync(new URL("server/services/noaa.ts", root), "utf8");

const NOW = 1_792_540_000; // Oct 20 2026
const WEEK_START = 1_792_972_800; // Mon Oct 26 00:00 UTC

function marketBuffer(opts: { slug?: keyof typeof CITY_HASHES; status?: number; salesCloseAt?: number; evidence?: boolean } = {}): Buffer {
  const slug = opts.slug ?? "new-york";
  const buf = Buffer.alloc(400);
  Buffer.from([219, 190, 213, 55, 0, 227, 198, 154]).copy(buf, 0);
  buf.writeBigUInt64LE(8n, 8);
  Buffer.from(CITY_HASHES[slug], "hex").copy(buf, 80);
  Buffer.from(opts.evidence === false ? "00".repeat(32) : STATION_ID_HASHES[slug], "hex").copy(buf, 112);
  Buffer.from(PROVIDER_HASH, "hex").copy(buf, 144);
  Buffer.from(METHODOLOGY_HASH, "hex").copy(buf, 176);
  Buffer.from("fb6e901bc43fa2a99b5044c115f94345696f4bb24c85ce9fe4a1760a9b8b45e8", "hex").copy(buf, 208);
  buf[240] = 1; // GreaterThanOrEqual
  buf.writeBigInt64LE(6900n, 241);
  buf.writeBigInt64LE(BigInt(opts.salesCloseAt ?? WEEK_START), 249);
  buf.writeBigInt64LE(BigInt(WEEK_START), 257);
  buf.writeBigInt64LE(BigInt(WEEK_START + 7 * 86_400), 265);
  buf.writeUInt16LE(2000, 289);
  buf.writeUInt16LE(2400, 291);
  buf[381] = opts.status ?? 1; // Open
  return buf;
}

function protocolBuffer(next: bigint): Buffer {
  const buf = Buffer.alloc(210);
  Buffer.from([207, 91, 250, 28, 152, 179, 215, 209]).copy(buf, 0);
  new PublicKey(SKYT_MINT).toBuffer().copy(buf, 136);
  buf.writeBigUInt64LE(next, 200);
  return buf;
}

function mintBuffer(): Buffer { const buf = Buffer.alloc(82); buf[44] = 6; return buf; }
function tokenBuffer(amount: bigint): Buffer { const buf = Buffer.alloc(165); buf.writeBigUInt64LE(amount, 64); return buf; }
// Plain Uint8Array, like Hermes: no Buffer BigInt helpers available to the decoder.
const info = (data: Buffer, executable = false) => ({ data: Uint8Array.from(data) as unknown as Buffer, executable, lamports: 1, owner: SKYHEDGE_PROGRAM_ID, rentEpoch: 0 });

describe("on-device Devnet status", () => {
  it("pins the same hashes the server computes", () => {
    for (const slug of LIVE_CITY_SLUGS) {
      assert.equal(CITY_HASHES[slug], sha(slug));
      assert.ok(noaaSource.includes(`stationId: "${NOAA_STATION_IDS[slug]}"`), `${slug} station id matches server/services/noaa.ts`);
      assert.equal(STATION_ID_HASHES[slug], canonical(NOAA_STATION_IDS[slug]));
    }
    assert.equal(DES_MOINES_TITLE_HASH, sha("Des Moines"));
    assert.equal(PROVIDER_HASH, canonical(methodology));
    assert.equal(METHODOLOGY_HASH, canonical(methodology.version));
    assert.equal(IDL_INSTRUCTION_COUNT, idl.instructions.length);
    assert.equal(IDL_ACCOUNT_COUNT, idl.accounts.length);
  });

  it("decodes the committed Market layout", () => {
    const market = decodeMarket(Uint8Array.from(marketBuffer()))!;
    assert.equal(market.id, "8");
    assert.equal(market.operator, "gte");
    assert.equal(market.thresholdMmX100, "6900");
    assert.equal(market.observationStart, WEEK_START);
    assert.equal(market.premiumRateBps, 2400);
    assert.equal(market.status, "Open");
  });

  it("lists only open, funded, evidence-pinned windows that are still selling", async () => {
    const accounts = [marketBuffer(), marketBuffer({ salesCloseAt: NOW - 1 }), marketBuffer({ status: 0 }), marketBuffer({ evidence: false })];
    let call = 0;
    const status = await readDevnetStatusFrom(async (keys) => {
      call++;
      if (call === 1) return [info(Buffer.alloc(36), true), info(mintBuffer()), info(protocolBuffer(4n)), info(tokenBuffer(5n))];
      if (call === 2) return keys.map((_, index) => info(accounts[index]!));
      return keys.map(() => info(tokenBuffer(2_000_000_000n)));
    }, NOW);
    assert.equal(call, 3);
    assert.equal(status.program.executable, true);
    assert.equal(status.protocol.collateralMint, SKYT_MINT);
    assert.equal(status.skytMint.decimals, 6);
    assert.equal(status.ladderMarkets!.length, 4);
    assert.equal(status.cityWindows!.length, 1);
    const window = status.cityWindows![0]!;
    assert.equal(window.tenor, "weekly");
    assert.equal(window.onchainStatus, "{\"Open\":{}}");
    assert.equal(window.evidenceStatus, "validated");
    assert.equal(window.vaultBalance, "2000000000");
  });

  it("prices from the on-chain rate with the server's math", () => {
    const quote = committedPremiumQuote({ protectedAmount: "100000000", probabilityBps: 2000, premiumRateBps: 2400, inputsHash: "fb6e901bc43fa2a99b5044c115f94345696f4bb24c85ce9fe4a1760a9b8b45e8" })!;
    assert.equal(quote.premium, "24000000");
    const pg = payGet({ coverageSkyt: 100, premiumRateBps: 2400, probabilityBps: 2000 })!;
    assert.equal(pg.payLabel, "24.00");
    assert.equal(pg.multiple, "4.1×");
    assert.equal(payGet({ coverageSkyt: 250, premiumRateBps: 2400, probabilityBps: 2000 })!.payLabel, "60.00");
  });

  it("uses no Buffer BigInt methods, which Hermes lacks", () => {
    for (const file of ["chain-status.ts", "open-position-tx.ts", "bytes.ts"]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      assert.doesNotMatch(source, /\.(read|write)Big(U)?Int64(LE|BE)\(/, file);
    }
  });

  it("falls back to the server and names both failures", async () => {
    const server = { network: "devnet" } as never;
    assert.equal(await loadDevnetStatus({ onDevice: async () => { throw new Error("429"); }, server: async () => server }), server);
    await assert.rejects(loadDevnetStatus({ onDevice: async () => { throw new Error("Devnet RPC timed out"); }, server: async () => { throw new Error("Service returned 503"); } }), /Phone Devnet RPC: Devnet RPC timed out.*SkyHedge server: Service returned 503/);
  });
});
