import "dotenv/config";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { sql } from "drizzle-orm";
import { createDb } from "../server/db";
import { ROOT } from "./lib/chain";

/**
 * Watches the devnet faucet and, the moment the wallet has >= TARGET_SOL,
 * runs the full devnet pipeline: deploy program → SKYT mint → init protocol →
 * faucet SKYT → seed markets → status. Logs every attempt to watch-deploy.log.
 *
 * The official devnet faucet is rate-limited per day per IP; this loop retries
 * periodically so the deploy completes unattended when the limit resets.
 */
const WALLET = "7zfJ9sYr1x2kA5qMkBAMd1DmFGZcdE6HzBNAutWkHF2c";
const TARGET_SOL = 4.0; // program rent (~3.34) + buffer + tx fees
const POLL_SECONDS = 90;
const LOG_PATH = path.join(ROOT, "watch-deploy.log");

function log(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.appendFileSync(LOG_PATH, `${line}\n`);
}

function balance(): number {
  const out = execSync(`solana balance ${WALLET} --url https://api.devnet.solana.com`, { encoding: "utf8" });
  return Number.parseFloat(out.match(/[\d.]+/)?.[0] ?? "0");
}

function sh(command: string, env: Record<string, string> = {}): string {
  log(`$ ${command}`);
  return execSync(command, { encoding: "utf8", env: { ...process.env as Record<string, string>, ...env } });
}

async function tryAirdrop(): Promise<boolean> {
  try {
    execSync(`npx tsx scripts/airdrop-sol.ts ${WALLET} 1 3`, { encoding: "utf8" });
    return true;
  } catch {
    return false;
  }
}

async function purgeDb(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    log("no DATABASE_URL — skipping DB purge (stale localnet rows may remain)");
    return;
  }
  try {
    const db = createDb();
    await db.execute(sql`TRUNCATE chain_events, markets, liquidity_positions, protection_positions, settlement_observations, indexed_slots;`);
    log("DB purged (stale localnet rows removed)");
  } catch (error) {
    log(`DB purge failed (continuing): ${(error as Error).message}`);
  }
}

async function deployPipeline(mint?: string): Promise<void> {
  log("== BALANCE OK — starting devnet pipeline ==");
  sh("npm run skyt:deploy");
  await purgeDb();

  if (!mint) {
    log("$ npm run skyt:mint");
    const output = execSync("npm run skyt:mint", { encoding: "utf8" });
    mint = output.match(/SKYT mint created\s+(\w+)/)?.[1];
    if (!mint) throw new Error(`could not parse SKYT mint from output:\n${output}`);
  }
  log("SKYT_MINT", mint);

  sh(`npm run skyt:faucet -- ${WALLET} 20000`, { SKYT_MINT: mint });
  sh("npm run skyt:init", { SKYT_MINT: mint });
  sh("npm run skyt:seed", { SKYT_MINT: mint });
  sh("npm run skyt:status");
  log("== PIPELINE COMPLETE ==");
}

async function main(): Promise<void> {
  log(`watcher started; wallet ${WALLET}; target ${TARGET_SOL} SOL; poll ${POLL_SECONDS}s`);
  const existingMint = process.env.SKYT_MINT;

  for (let attempt = 1; ; attempt++) {
    const bal = balance();
    if (bal >= TARGET_SOL) {
      try {
        await deployPipeline(existingMint);
        process.exit(0);
      } catch (error) {
        log(`pipeline failed: ${(error as Error).message}`);
        process.exit(1);
      }
    }
    log(`attempt ${attempt}: balance ${bal} SOL (need ${TARGET_SOL}) — trying airdrop`);
    const ok = await tryAirdrop();
    if (ok) log("airdrop request accepted — balance will update next poll");
    await new Promise((r) => setTimeout(r, POLL_SECONDS * 1000));
  }
}

void main().catch((error) => { log(`watcher error: ${error.message}`); process.exitCode = 1; });