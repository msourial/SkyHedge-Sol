/**
 * Devnet-only: create / fund / open a fresh Des Moines market when the prior
 * Open market has closed sales. Signs with PROTOCOL_ADMIN_KEYPAIR when set;
 * otherwise prints unsigned base64 txs for Phantom (Chrome) signing.
 */
import { createHash } from "node:crypto";
import { readFileSync, appendFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  assertFreshMarketCounterMatches,
  DES_MOINES_SEED_LIQUIDITY_BASE,
  marketStateFromStatusJson,
  planDesMoinesSeed,
} from "../shared/des-moines-seed-plan.ts";
import { isValidImmutableMarketPricingTerms } from "../shared/market-pricing.ts";
import { isValidDesMoinesSeedSchedule } from "../shared/des-moines-seed-plan.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPS_LOG = path.join(ROOT, "docs/devnet-ops.md");
const PROGRAM_ID = new PublicKey("5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx");
const PROTOCOL_ADMIN = new PublicKey("DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y");
const SKYT_MINT = new PublicKey("3Y1SaGnJiPez3hkcHom2gimtVEm7W7R8imeRMPTUaK9g");
const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const API = process.env.SKYHEDGE_API ?? "https://skyhedge.app";
const createMarketDiscriminator = Buffer.from([103, 226, 97, 235, 200, 188, 251, 254]);
const fundPoolDiscriminator = Buffer.from([36, 57, 233, 176, 181, 20, 87, 159]);
const openMarketDiscriminator = Buffer.from([116, 19, 123, 75, 217, 244, 69, 44]);

function u64(value: bigint): Buffer {
  const out = Buffer.alloc(8);
  out.writeBigUInt64LE(value);
  return out;
}
function i64(value: bigint): Buffer {
  const out = Buffer.alloc(8);
  out.writeBigInt64LE(value);
  return out;
}
function u16(value: number): Buffer {
  const out = Buffer.alloc(2);
  out.writeUInt16LE(value);
  return out;
}
function hashBytes(value: string, name: string): Buffer {
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error(`${name} must be hex32`);
  return Buffer.from(value, "hex");
}
async function sha256Hex(text: string): Promise<Buffer> {
  return createHash("sha256").update(text).digest();
}
function logOps(block: string) {
  appendFileSync(OPS_LOG, block.endsWith("\n") ? block : `${block}\n`);
}
function loadAdminKeypair(): Keypair | null {
  const p = process.env.PROTOCOL_ADMIN_KEYPAIR;
  if (!p || !existsSync(p)) return null;
  const secret = Uint8Array.from(JSON.parse(readFileSync(p, "utf8")) as number[]);
  const kp = Keypair.fromSecretKey(secret);
  if (!kp.publicKey.equals(PROTOCOL_ADMIN)) {
    throw new Error(`PROTOCOL_ADMIN_KEYPAIR pubkey ${kp.publicKey.toBase58()} != ${PROTOCOL_ADMIN.toBase58()}`);
  }
  return kp;
}

async function main() {
  const connection = new Connection(RPC, "finalized");
  const [status, evidence] = await Promise.all([
    fetch(`${API}/api/devnet/status`).then((r) => r.json()),
    fetch(`${API}/api/evidence-package`).then((r) => r.json()),
  ]);
  if (!evidence?.validated || !evidence.quoteTerms) throw new Error("NOAA evidence/quote package unavailable");
  if (!isValidImmutableMarketPricingTerms(evidence.quoteTerms)) throw new Error("quote terms incomplete");
  if (!isValidDesMoinesSeedSchedule(evidence.seedSchedule)) throw new Error("seed schedule invalid");

  const admin = PROTOCOL_ADMIN;
  const protocol = PublicKey.findProgramAddressSync([Buffer.from("protocol")], PROGRAM_ID)[0];
  const protocolInfo = await connection.getAccountInfo(protocol, "finalized");
  if (!protocolInfo || protocolInfo.data.length < 208) throw new Error("protocol missing");
  const nextMarketId = protocolInfo.data.readBigUInt64LE(200);
  assertFreshMarketCounterMatches(status.protocol.nextMarketId, nextMarketId);

  const marketState = marketStateFromStatusJson(status.desMoinesMarket?.onchainStatus ?? null) ?? "missing";
  const nowSeconds = Math.floor(Date.now() / 1_000);
  const salesCloseAt = status.desMoinesMarket?.salesCloseAt ?? null;
  const salesClosedOpen = marketState === "open" && salesCloseAt !== null && salesCloseAt <= nowSeconds;
  const terminal = ["settled", "data_unavailable", "closed", "cancelled"].includes(marketState);
  if (marketState === "open" && !salesClosedOpen) throw new Error("Des Moines still has open sales; refusing duplicate seed");
  if (marketState === "locked" || marketState === "awaiting_settlement") throw new Error("Des Moines lifecycle in progress; refusing duplicate seed");
  if (marketState === "draft" && salesCloseAt !== null && salesCloseAt <= nowSeconds) {
    throw new Error("Expired Draft must be cancelled before a fresh seed");
  }

  const useExisting = false; // fresh ID when prior open sales closed, or missing/terminal
  if (!(salesClosedOpen || marketState === "missing" || terminal)) {
    throw new Error(`Cannot seed from market state ${marketState}`);
  }
  void useExisting;

  const plan = planDesMoinesSeed(
    {
      state: salesClosedOpen || terminal || marketState === "missing" ? (salesClosedOpen ? "open" : marketState === "missing" ? "missing" : marketState) : "missing",
      salesCloseAt: salesClosedOpen ? salesCloseAt : null,
      observationStart: null,
      observationEnd: null,
      quoteProbabilityBps: null,
      premiumRateBps: null,
      quoteInputsHash: null,
      totalShares: "0",
    },
    { ...evidence.seedSchedule, ...evidence.quoteTerms },
    nowSeconds,
  );
  if (plan.alreadyOpen || plan.steps.length === 0) throw new Error("Planner returned no steps");

  const marketId = nextMarketId;
  const [market] = PublicKey.findProgramAddressSync([Buffer.from("market"), protocol.toBuffer(), u64(marketId)], PROGRAM_ID);
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), market.toBuffer()], PROGRAM_ID);
  const [liquidityPosition] = PublicKey.findProgramAddressSync(
    [Buffer.from("liquidity"), market.toBuffer(), admin.toBuffer()],
    PROGRAM_ID,
  );
  if (await connection.getAccountInfo(market, "finalized")) {
    throw new Error(`Market ID ${marketId} already exists`);
  }

  const cityHash = await sha256Hex("des-moines");
  const terms = evidence.quoteTerms;
  const schedule = evidence.seedSchedule;
  const adminAta = getAssociatedTokenAddressSync(SKYT_MINT, admin);
  const createData = Buffer.concat([
    createMarketDiscriminator,
    cityHash,
    hashBytes(evidence.stationIdHash, "stationIdHash"),
    hashBytes(evidence.providerHash, "providerHash"),
    hashBytes(evidence.methodologyHash, "methodologyHash"),
    hashBytes(terms.inputsHash, "quoteInputsHash"),
    Buffer.from([1]),
    i64(5_000n),
    i64(BigInt(schedule.salesCloseAt)),
    i64(BigInt(schedule.observationStart)),
    i64(BigInt(schedule.observationEnd)),
    u16(terms.probabilityBps),
    u64(10_000_000_000n),
    u64(8_000_000_000n),
    u64(500_000_000n),
  ]);
  const createIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: protocol, isSigner: false, isWritable: true },
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: SKYT_MINT, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: createData,
  });
  const fundIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: protocol, isSigner: false, isWritable: false },
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: adminAta, isSigner: false, isWritable: true },
      { pubkey: liquidityPosition, isSigner: false, isWritable: true },
      { pubkey: SKYT_MINT, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([fundPoolDiscriminator, u64(plan.additionalFundingBase)]),
  });
  const openIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: protocol, isSigner: false, isWritable: false },
      { pubkey: market, isSigner: false, isWritable: true },
    ],
    data: openMarketDiscriminator,
  });

  const steps = plan.steps.map((step) => ({
    step,
    ix: step === "create" ? createIx : step === "fund" ? fundIx : openIx,
  }));

  console.log(JSON.stringify({
    marketId: marketId.toString(),
    market: market.toBase58(),
    vault: vault.toBase58(),
    salesCloseAt: new Date(schedule.salesCloseAt * 1000).toISOString(),
    observationEnd: new Date(schedule.observationEnd * 1000).toISOString(),
    premiumRateBps: terms.premiumRateBps,
    steps: steps.map((s) => s.step),
    fundSkyt: Number(plan.additionalFundingBase) / 1e6,
  }, null, 2));

  const adminKp = loadAdminKeypair();
  if (adminKp) {
    for (const { step, ix } of steps) {
      const pre = `TX ${step} PRE: Des Moines market ${marketId} ${step}; signer ${admin.toBase58()}; market ${market.toBase58()}`;
      console.log(pre);
      const tx = new Transaction().add(ix);
      const sig = await sendAndConfirmTransaction(connection, tx, [adminKp], { commitment: "finalized" });
      console.log(`TX ${step} POST signature: ${sig}`);
      logOps(`## TX — Des Moines ${step} (market ${marketId})\n- **PRE:** ${pre}\n- **POST signature:** \`${sig}\`\n- **Explorer:** https://explorer.solana.com/tx/${sig}?cluster=devnet\n\n`);
    }
    return;
  }

  // Phantom browser signing fallback (Chrome extension holds DKA9).
  const prepared: Array<{ step: string; base64: string }> = [];
  for (const { step, ix } of steps) {
    const tx = new Transaction().add(ix);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");
    tx.feePayer = admin;
    tx.recentBlockhash = blockhash;
    (tx as Transaction & { lastValidBlockHeight?: number }).lastValidBlockHeight = lastValidBlockHeight;
    prepared.push({ step, base64: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64") });
  }

  const port = Number(process.env.SEED_SIGNER_PORT ?? 8765);
  const tmpDir = path.join(ROOT, ".tmp-seed-signer");
  mkdirSync(tmpDir, { recursive: true });
  const bundlePath = path.join(tmpDir, "seed-signer.js");
  const bundle = spawnSync(
    "npx",
    ["esbuild", path.join(ROOT, "scripts/seed-signer-browser.js"), "--bundle", "--format=iife", `--outfile=${bundlePath}`, "--platform=browser"],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (bundle.status !== 0) throw new Error(`esbuild failed: ${bundle.stderr || bundle.stdout}`);
  const bundleJs = readFileSync(bundlePath, "utf8");
  writeFileSync(
    path.join(tmpDir, "payload.json"),
    JSON.stringify({ steps: prepared, expectedAdmin: PROTOCOL_ADMIN.toBase58() }),
  );
  const html = `<!doctype html><meta charset="utf-8"/><title>SkyHedge Devnet seed signer</title>
<body style="font-family:system-ui;padding:24px;background:#0b1220;color:#e8eef8;max-width:720px">
<h1>Des Moines fresh seed (Devnet)</h1>
<p>Unlock Phantom in this Chrome profile as <code>${PROTOCOL_ADMIN.toBase58()}</code>, then click Start and approve create → fund → open.</p>
<button id="start" style="font-size:18px;padding:12px 20px;cursor:pointer">Start seed with Phantom</button>
<pre id="log" style="margin-top:16px;white-space:pre-wrap"></pre>
<script>${bundleJs}</script>
<script>
const payload = ${JSON.stringify({ steps: prepared, expectedAdmin: PROTOCOL_ADMIN.toBase58() })};
const start = () => window.SkyHedgeSeedSigner.run(payload.steps, payload.expectedAdmin);
document.getElementById("start").onclick = start;
// Auto-start so an already-open Chrome tab only needs Phantom approvals.
setTimeout(start, 400);
</script></body>`;

  const results: Array<{ step: string; signature: string }> = [];
  await new Promise<void>((resolve, reject) => {
    const server = createServer(async (req, res) => {
      if (req.method === "GET" && (req.url === "/" || req.url?.startsWith("/?"))) {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(html);
        return;
      }
      if (req.method === "POST" && req.url === "/result") {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { step?: string; signature?: string; error?: string; m?: string };
        if (body.error) {
          // Keep listening: headless browsers without Phantom may hit this page first.
          console.error(`signer client note: ${body.error}`);
          res.end("ok");
          return;
        }
        if (body.signature && body.step) {
          console.log(`TX ${body.step} POST signature: ${body.signature}`);
          logOps(`## TX — Des Moines ${body.step} (market ${marketId})\n- **PRE:** Phantom-signed ${body.step} for market ${marketId} (${market.toBase58()})\n- **POST signature:** \`${body.signature}\`\n- **Explorer:** https://explorer.solana.com/tx/${body.signature}?cluster=devnet\n\n`);
          results.push({ step: body.step, signature: body.signature });
        }
        if (body.m === "done" || (results.length >= steps.length)) {
          res.end("ok");
          server.close();
          resolve();
          return;
        }
        res.end("ok");
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(port, "127.0.0.1", () => {
      console.log(`Open Phantom signer: http://127.0.0.1:${port}/`);
      for (const { step } of steps) {
        console.log(`TX ${step} PRE: create/fund/open Des Moines market ${marketId} via Phantom ${PROTOCOL_ADMIN.toBase58()}`);
      }
    });
    setTimeout(() => {
      server.close();
      reject(new Error("Phantom signing timed out after 2 hours"));
    }, 7_200_000);
  });
  console.log("seed complete", results);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
