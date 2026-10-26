import assert from "node:assert/strict";
import { perilCityHashHex } from "../../shared/perils.ts";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { Buffer } from "buffer";
import { PublicKey } from "@solana/web3.js";
import { positionAccountFilters, POSITION_DATA_SIZE, POSITION_OWNER_OFFSET, protectionView, readFinalizedProtections, SKYHEDGE_PROGRAM_ID } from "./positions.ts";

const OWNER = "DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y";
const MARKET = "Bi7RnLKP7cvp4Q8F5YzZmaRiR9J9p51k2SbtEToGbd7U";
const POSITION = "H1qKXbHatEpNupdP6R9wpwz348Jso48zKcYWKKVgc7L1";
const DISC = Buffer.from([157, 171, 49, 175, 119, 109, 126, 129]);

function positionBytes(): Buffer {
  const data = Buffer.alloc(POSITION_DATA_SIZE);
  DISC.copy(data, 0);
  new PublicKey(MARKET).toBuffer().copy(data, 8);
  new PublicKey(OWNER).toBuffer().copy(data, 40);
  data.writeBigUInt64LE(100_000_000n, 72);
  data.writeBigUInt64LE(24_000_000n, 80);
  data.writeBigUInt64LE(100_000_000n, 88);
  data.writeBigInt64LE(1_792_218_000n, 96);
  return data;
}

const DURING_NEW_YORK = 1_792_509_000;

function marketBytes(): Buffer {
  const data = Buffer.alloc(384);
  Buffer.from(createHash("sha256").update("new-york").digest("hex"), "hex").copy(data, 80);
  data[240] = 1;
  data.writeBigInt64LE(2900n, 241);
  data.writeBigInt64LE(1_792_368_000n, 257);
  data.writeBigInt64LE(1_792_972_800n, 265);
  data[381] = 1;
  data[382] = 0;
  return data;
}

/** Live Des Moines market: start 2026-10-14T00:00Z, exclusive end 2026-10-19T00:00Z, still Open. */
function desMoinesMarket(status = 1, result = 0): Buffer {
  const data = marketBytes();
  Buffer.from(createHash("sha256").update("des-moines").digest("hex"), "hex").copy(data, 80);
  data.writeBigInt64LE(5000n, 241);
  data.writeBigInt64LE(1_791_936_000n, 257);
  data.writeBigInt64LE(1_792_368_000n, 265);
  data[381] = status;
  data[382] = result;
  return data;
}

describe("position accounts", () => {
  it("filters program accounts by the owner pubkey at offset 40", () => {
    assert.deepEqual(positionAccountFilters(OWNER), [
      { dataSize: POSITION_DATA_SIZE },
      { memcmp: { offset: POSITION_OWNER_OFFSET, bytes: OWNER } },
    ]);
  });

  it("presents city, window, trigger, premium, payout and status from account bytes", () => {
    const view = protectionView(POSITION, positionBytes(), marketBytes(), DURING_NEW_YORK);
    assert.ok(view);
    assert.equal(view.city, "New York");
    assert.equal(view.windowLabel, "Oct 19 – Oct 26 (UTC)");
    assert.equal(view.triggerLabel, "≥ 29 mm");
    assert.equal(view.premiumPaid, "24000000");
    assert.equal(view.potentialPayout, "100000000");
    assert.equal(view.statusLabel, "Active");
    assert.equal(view.explorerUrl, `https://explorer.solana.com/address/${POSITION}?cluster=devnet`);
  });

  it("uses the account window, and waits for NOAA after that window ends", () => {
    const afterWindow = 1_792_509_943;
    const waiting = protectionView(POSITION, positionBytes(), desMoinesMarket(), afterWindow);
    assert.equal(waiting?.windowLabel, "Oct 14 – Oct 19 (UTC)");
    assert.equal(waiting?.triggerLabel, "≥ 50 mm");
    assert.equal(waiting?.statusLabel, "Awaiting NOAA final data");
    assert.equal(protectionView(POSITION, positionBytes(), desMoinesMarket(4, 1), afterWindow)?.statusLabel, "Payout ready to collect");
    assert.equal(protectionView(POSITION, positionBytes(), desMoinesMarket(4, 2), afterWindow)?.statusLabel, "Not triggered");
    const claimed = positionBytes();
    claimed[104] = 1;
    assert.equal(protectionView(POSITION, claimed, desMoinesMarket(4, 1), afterWindow)?.statusLabel, "Paid");
    assert.equal(protectionView(POSITION, claimed, desMoinesMarket(4, 1), afterWindow)?.payoutClaimed, true);
  });

  it("decodes the native unit and city for snow, wind and heat without calling them rain", () => {
    for (const [city, peril, unit] of [["chicago", "snow", "mm"], ["chicago", "wind", "m/s"], ["miami", "heat", "C"]] as const) {
      const data = marketBytes();
      Buffer.from(perilCityHashHex(city, peril), "hex").copy(data, 80);
      const view = protectionView(POSITION, positionBytes(), data, DURING_NEW_YORK);
      assert.equal(view?.peril, peril);
      assert.equal(view?.cityId, city);
      assert.equal(view?.triggerValue, 29);
      assert.equal(view?.triggerLabel, `≥ 29 ${unit}`);
    }
  });

  it("retries a failing RPC and then reads the next endpoint", async () => {
    let calls = 0;
    const rows = await readFinalizedProtections(OWNER, {
      urls: ["https://rpc.a", "https://rpc.b"],
      attempts: 2,
      timeoutMs: 1_000,
      getProgramAccounts: async () => {
        calls += 1;
        if (calls < 3) throw new Error("429");
        return [{ pubkey: new PublicKey(POSITION), data: positionBytes() }];
      },
      getMultipleAccounts: async () => [marketBytes()],
      nowSeconds: DURING_NEW_YORK,
    });
    assert.equal(calls, 3);
    assert.equal(rows[0]?.city, "New York");
    assert.equal(rows[0]?.statusLabel, "Active");
  });

  it("derives position PDAs when getProgramAccounts fails on every RPC", async () => {
    const programId = SKYHEDGE_PROGRAM_ID;
    const [protocol] = PublicKey.findProgramAddressSync([Buffer.from("protocol")], programId);
    const protocolData = Buffer.alloc(210);
    protocolData.writeBigUInt64LE(1n, 200);
    const id = Buffer.alloc(8);
    id.writeBigUInt64LE(0n);
    const [market] = PublicKey.findProgramAddressSync([Buffer.from("market"), protocol.toBuffer(), id], programId);
    const [position] = PublicKey.findProgramAddressSync([Buffer.from("position"), market.toBuffer(), new PublicKey(OWNER).toBuffer()], programId);
    const rows = await readFinalizedProtections(OWNER, {
      urls: ["https://rpc.a"],
      attempts: 1,
      timeoutMs: 1_000,
      programId,
      getProgramAccounts: async () => { throw new Error("getProgramAccounts disabled"); },
      getAccount: async (_url, key) => key.equals(protocol) ? protocolData : null,
      getMultipleAccounts: async (_url, keys) => keys.map((key) => {
        if (key.equals(market)) return marketBytes();
        if (key.equals(position)) return positionBytes();
        return null;
      }),
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.address, position.toBase58());
    assert.equal(rows[0]?.premiumPaid, "24000000");
  });

  it("returns an empty list when the scan finds no position accounts", async () => {
    const rows = await readFinalizedProtections(OWNER, {
      urls: ["https://rpc.a"],
      attempts: 1,
      getProgramAccounts: async () => [],
    });
    assert.deepEqual(rows, []);
  });
});
