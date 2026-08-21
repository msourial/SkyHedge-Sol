import "dotenv/config";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { BN } from "bn.js";
import type { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, type Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "../..");

export const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
export const PROGRAM_ID = new PublicKey(process.env.SKYHEDGE_PROGRAM_ID ?? "7thTyPBaVCEBL2z28ojTxfmrbNMydXV3EAgbYgrz7GKr");
export const SKYT_DECIMALS = 6;
export const UNIT = 10 ** SKYT_DECIMALS;
export const PROGRAM_KEYPAIR_PATH = path.join(ROOT, "anchor/target/deploy/skyhedge_protection-keypair.json");
export const SETTLEMENT_KEYPAIR_PATH = path.join(ROOT, "anchor/keys/settlement-authority.json");
export const METHODOLOGY_PATH = path.join(ROOT, "shared/methodology-v1.json");

export function loadKeypair(relativeOrAbsolute: string): Keypair {
  const resolved = path.isAbsolute(relativeOrAbsolute) ? relativeOrAbsolute : path.join(ROOT, relativeOrAbsolute);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(resolved, "utf8")) as number[]));
}

export function loadDeployer(): Keypair {
  const env = process.env.DEPLOYER_KEYPAIR;
  if (env) return loadKeypair(env);
  return loadKeypair(path.join(process.env.HOME ?? "~", ".config/solana/id.json"));
}

export function loadSettlementAuthority(): Keypair {
  const env = process.env.SETTLEMENT_AUTHORITY_KEYPAIR;
  if (env) return loadKeypair(env);
  return loadKeypair(SETTLEMENT_KEYPAIR_PATH);
}

export function sha256Bytes(value: Buffer | string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function sha256Hex(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function hashBufferAsArray(value: Buffer | string): number[] {
  return Array.from(sha256Bytes(value));
}

export async function loadProgram(connection: Connection, wallet?: Keypair): Promise<Program> {
  const { Program, AnchorProvider, Wallet } = await import("@coral-xyz/anchor");
  const idl = JSON.parse(fs.readFileSync(path.join(ROOT, "shared/idl/skyhedge_protection.json"), "utf8"));
  const signer = wallet ?? Keypair.generate();
  const provider = new AnchorProvider(connection, new Wallet(signer) as never, { commitment: "confirmed" });
  return new Program(idl, provider);
}

export function protocolPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("protocol")], PROGRAM_ID);
}

export function feeVaultPda(protocol: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("fee-vault"), protocol.toBuffer()], PROGRAM_ID);
}

export function marketPda(protocol: PublicKey, marketId: number | bigint): [PublicKey, number] {
  const id = Buffer.alloc(8);
  id.writeBigUInt64LE(BigInt(marketId));
  return PublicKey.findProgramAddressSync([Buffer.from("market"), protocol.toBuffer(), id], PROGRAM_ID);
}

export function vaultPda(market: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("vault"), market.toBuffer()], PROGRAM_ID);
}

export function positionPda(market: PublicKey, owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("position"), market.toBuffer(), owner.toBuffer()], PROGRAM_ID);
}

export function liquidityPda(market: PublicKey, provider: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("liquidity"), market.toBuffer(), provider.toBuffer()], PROGRAM_ID);
}

export function observationPda(market: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("settlement"), market.toBuffer()], PROGRAM_ID);
}

export const TOKEN_PROGRAM = TOKEN_PROGRAM_ID;

export function bn(value: bigint | number): InstanceType<typeof BN> {
  return new BN(value.toString());
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function log(label: string, value: unknown): void {
  console.log(`${label}: ${typeof value === "string" ? value : JSON.stringify(value, null, 2)}`);
}