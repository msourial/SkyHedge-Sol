/**
 * Local Phantom page for the missing Devnet ladder rungs.
 * The admin key stays in Phantom. This script never reads or writes it.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { DES_MOINES_SEED_LIQUIDITY_BASE } from "../shared/des-moines-seed-plan.ts";
import { TEST_SKYT_MINT } from "../server/services/window-keeper.ts";
import { phantomLadderPayload } from "../server/services/window-keeper-run.ts";

config();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPS_LOG = path.join(ROOT, "docs/devnet-ops.md");
const EXPECTED_ADMIN = "DKA9RkGvaW4isyj5xdiZ2oGVUkD1UL64Ha1BazXZFD6y";

async function main() {
  const payload = await phantomLadderPayload();
  if (payload.expectedAdmin !== EXPECTED_ADMIN) {
    throw new Error(`Protocol admin is ${payload.expectedAdmin}. Expected DKA9 on Devnet.`);
  }
  const connection = new Connection(payload.rpc, "finalized");
  const ata = getAssociatedTokenAddressSync(new PublicKey(TEST_SKYT_MINT), new PublicKey(EXPECTED_ADMIN));
  const balance = await connection.getTokenAccountBalance(ata).catch(() => null);
  const needed = (payload.summary.filter((row) => row.action !== "open").length * Number(DES_MOINES_SEED_LIQUIDITY_BASE)) / 1_000_000;
  console.log(JSON.stringify({
    admin: payload.expectedAdmin,
    skytBalance: balance?.value.uiAmountString ?? "0",
    fundSkytNeeded: needed,
    summary: payload.summary,
    skipped: payload.skipped,
    approvals: payload.steps.map((step) => step.step),
  }, null, 2));
  if (payload.steps.length === 0) {
    console.log("No missing rungs to sign.");
    return;
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
  if (bundle.status !== 0) throw new Error(bundle.stderr || bundle.stdout || "esbuild failed");
  const html = `<!doctype html><meta charset="utf-8"/><title>SkyHedge ladder signer</title>
<body style="font-family:system-ui;padding:24px;background:#0b1220;color:#e8eef8;max-width:720px">
<h1>Des Moines ladder (Devnet)</h1>
<p>Unlock Phantom as <code>${EXPECTED_ADMIN}</code> on Devnet. Approve each missing rung: create, fund 2,000 SKYT, then open.</p>
<ul>${payload.summary.map((row) => `<li>${row.label}: ≥${row.thresholdMm} mm, premium ${row.premiumRateBps} bps</li>`).join("")}</ul>
<button id="start" style="font-size:18px;padding:12px 20px;cursor:pointer">Start with Phantom</button>
<pre id="log" style="margin-top:16px;white-space:pre-wrap"></pre>
<script>${readFileSync(bundlePath, "utf8")}</script>
<script>
const payload = ${JSON.stringify({ rpc: payload.rpc, expectedAdmin: payload.expectedAdmin, steps: payload.steps })};
document.getElementById("start").onclick = () => window.SkyHedgeSeedSigner.run(payload);
</script></body>`;

  const results: Array<{ step: string; signature: string }> = [];
  await new Promise<void>((resolve, reject) => {
    const server = createServer(async (req, res) => {
      if (req.method === "GET" && (req.url === "/" || req.url?.startsWith("/?"))) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }
      if (req.method === "POST" && req.url === "/result") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { step?: string; signature?: string; error?: string; m?: string };
        if (body.error) {
          console.error(`signer: ${body.error}`);
          res.end("ok");
          return;
        }
        if (body.signature && body.step) {
          console.log(`TX ${body.step} POST signature: ${body.signature}`);
          appendFileSync(OPS_LOG, `## TX — ladder ${body.step}\n- **POST signature:** \`${body.signature}\`\n- **Explorer:** https://explorer.solana.com/tx/${body.signature}?cluster=devnet\n\n`);
          results.push({ step: body.step, signature: body.signature });
        }
        if (body.m === "done" || results.length >= payload.steps.length) {
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
    });
    setTimeout(() => {
      server.close();
      reject(new Error("Phantom signing timed out after 2 hours"));
    }, 7_200_000).unref();
  });
  writeFileSync(path.join(tmpDir, "ladder-signatures.json"), JSON.stringify(results, null, 2));
  console.log("ladder signatures", results.length);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
