import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { VersionedTransaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { ApiError } from "./api.ts";
import { prepareUnsignedTransaction } from "./prepare-tx.ts";
import { buildOpenPositionOnDevice, openPositionKeys, OPEN_POSITION_DISCRIMINATOR } from "./open-position-tx.ts";

const MARKET = "4MVypmwGhpNTvLhpEUTPu6AHEXL5aRzuprkPWT9o6ygq";
const WALLET = "DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y";
const HASH = "11111111111111111111111111111111";
const tx = { action: "open_position", market: MARKET, wallet: WALLET, base64: "AA==", network: "devnet" };

describe("open_position prepared on the phone", () => {
  it("derives the same vault and position PDAs the server uses", () => {
    const keys = openPositionKeys(MARKET, WALLET);
    assert.equal(keys.vault.toBase58(), "468foL4UNVm1TBmjPfpjdubLJJrEth5y8v4wXRnbpDCJ");
    assert.equal(keys.collateralMint.toBase58(), "3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g");
  });
  it("builds an unsigned tx the wallet pays for, with the protected amount", async () => {
    const built = await buildOpenPositionOnDevice({ market: MARKET, wallet: WALLET, amount: "100000000", getBlockhash: async () => HASH });
    const parsed = VersionedTransaction.deserialize(Buffer.from(built.base64, "base64"));
    assert.equal(parsed.message.staticAccountKeys[0]!.toBase58(), WALLET);
    assert.equal(parsed.message.header.numRequiredSignatures, 1);
    const data = Buffer.from(parsed.message.compiledInstructions[0]!.data);
    assert.deepEqual([...data.subarray(0, 8)], [...OPEN_POSITION_DISCRIMINATOR]);
    assert.equal(data.readBigUInt64LE(8), 100_000_000n);
    assert.equal(built.network, "devnet");
  });
  it("rejects a missing amount", async () => {
    await assert.rejects(buildOpenPositionOnDevice({ market: MARKET, wallet: WALLET, amount: "", getBlockhash: async () => HASH }));
  });
});

describe("prepareUnsignedTransaction", () => {
  it("uses the phone build and skips the rate-limited server", async () => {
    let serverCalls = 0;
    const out = await prepareUnsignedTransaction({ action: "open_position", market: MARKET, wallet: WALLET, amount: "1", onDevice: async () => tx, server: async () => { serverCalls++; return tx; } });
    assert.equal(out, tx); assert.equal(serverCalls, 0);
  });
  it("falls back to the server when the phone RPC fails", async () => {
    const out = await prepareUnsignedTransaction({ action: "open_position", market: MARKET, wallet: WALLET, amount: "1", onDevice: async () => { throw new Error("429"); }, server: async () => tx });
    assert.equal(out, tx);
  });
  it("shows both real errors behind Details when both fail", async () => {
    await assert.rejects(
      prepareUnsignedTransaction({ action: "open_position", market: MARKET, wallet: WALLET, amount: "1", onDevice: async () => { throw new Error("Devnet RPC timed out"); }, server: async () => { throw new ApiError("Devnet is busy, try again", "failed to get recent blockhash: 429 Too Many Requests"); } }),
      (error: unknown) => error instanceof ApiError && error.message === "Devnet is busy, try again" && /Phone Devnet RPC: Devnet RPC timed out/.test(error.detail ?? "") && /429 Too Many Requests/.test(error.detail ?? ""),
    );
  });
  it("claims still go through the server", async () => {
    let device = 0;
    await prepareUnsignedTransaction({ action: "claim_payout", market: MARKET, wallet: WALLET, amount: "", onDevice: async () => { device++; return tx; }, server: async () => tx });
    assert.equal(device, 0);
  });
});
