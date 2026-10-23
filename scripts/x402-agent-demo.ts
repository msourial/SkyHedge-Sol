/**
 * Local agent for GET /api/x402/quote.
 * Dry-run prints the 402 and stops. Pay mode signs a Devnet USDC transfer
 * from a keypair file (X402_AGENT_KEYPAIR) and prints the quote plus Explorer link.
 * --bad-payment resends the 402 with the wrong amount and expects a refusal.
 * This file never writes a key and never targets mainnet.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { x402Client, x402HTTPClient } from "@x402/fetch";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import type { PaymentPayload } from "@x402/core/types";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { SOLANA_DEVNET_CAIP2 } from "../server/services/x402-facilitator.js";

const dryRun = process.argv.includes("--dry-run");
const badPayment = process.argv.includes("--bad-payment");

async function main() {
  const url = quoteUrl();
  console.log(`${dryRun ? "Dry run" : badPayment ? "Bad payment" : "Pay"} ${url}\n`);
  const first = await fetch(url);
  const firstBody = await readJson(first);
  const required = paymentRequired(first, firstBody);
  console.log(`HTTP ${first.status}`);
  console.log(JSON.stringify(required ?? firstBody, null, 2));
  if (dryRun) {
    if (first.status !== 402 || !required) {
      console.error("\nDry run expected HTTP 402 with payment requirements.");
      process.exitCode = 1;
    }
    return;
  }
  if (first.status !== 402 || !required) {
    console.error("\nThe endpoint did not return a payable 402.");
    process.exitCode = 1;
    return;
  }
  if (badPayment) {
    await rejectWrongAmount(url, required);
    return;
  }
  await pay(url, first);
}

function quoteUrl(): URL {
  const base = process.env.X402_QUOTE_URL ?? "https://skyhedge.app/api/x402/quote";
  const url = new URL(base);
  const flags: Record<string, string> = {
    city: "city",
    "observation-start": "observationStart",
    "observation-end": "observationEnd",
    "threshold-mm": "thresholdMm",
    operator: "operator",
    "protected-amount": "protectedAmount",
  };
  for (const [flag, param] of Object.entries(flags)) {
    const value = argument(flag);
    if (value) url.searchParams.set(param, value);
  }
  for (const param of Object.values(flags)) {
    if (!url.searchParams.get(param)) {
      throw new Error(`Missing --${Object.entries(flags).find(([, name]) => name === param)?.[0]}. The quote parameters are required.`);
    }
  }
  return url;
}

async function pay(url: URL, first: Response) {
  const keyPath = process.env.X402_AGENT_KEYPAIR;
  if (!keyPath) throw new Error("Set X402_AGENT_KEYPAIR to a gitignored Solana keypair JSON file. Do not commit it.");
  const bytes = Uint8Array.from(JSON.parse(readFileSync(keyPath, "utf8")) as number[]);
  if (bytes.length !== 64) throw new Error("X402_AGENT_KEYPAIR must be a 64-byte Solana CLI keypair file.");
  const signer = await createKeyPairSignerFromBytes(bytes);
  const client = new x402Client();
  client.register(SOLANA_DEVNET_CAIP2, new ExactSvmScheme(signer, { rpcUrl: process.env.SOLANA_RPC_URL }));
  const http = new x402HTTPClient(client);
  const required = http.getPaymentRequiredResponse((name) => first.headers.get(name));
  const payload = await http.createPaymentPayload(required);
  const paid = await fetch(url, { headers: http.encodePaymentSignatureHeader(payload) });
  const body = await readJson(paid);
  console.log(`\nHTTP ${paid.status}`);
  console.log(JSON.stringify(body, null, 2));
  const explorer = body && typeof body === "object" && "payment" in body ? (body.payment as { explorer?: string }).explorer : undefined;
  if (paid.ok && explorer) console.log(`\nExplorer: ${explorer}`);
  if (!paid.ok) process.exitCode = 1;
}

async function rejectWrongAmount(url: URL, required: { accepts?: Array<Record<string, unknown>> }) {
  const accepted = required.accepts?.[0];
  if (!accepted) throw new Error("The 402 did not include an accepted payment option.");
  const header = encodePaymentSignatureHeader({
    x402Version: 2,
    accepted: { ...accepted, amount: "1" },
    payload: { transaction: "AA==" },
  } as unknown as PaymentPayload);
  const refused = await fetch(url, { headers: { "PAYMENT-SIGNATURE": header } });
  const body = await readJson(refused);
  console.log(`\nHTTP ${refused.status}`);
  console.log(JSON.stringify(body, null, 2));
  const error = body && typeof body === "object" && "error" in body ? body.error : undefined;
  if (refused.status !== 402 || error !== "WRONG_AMOUNT" || (body && typeof body === "object" && "premium" in body)) {
    console.error("\nExpected a 402 WRONG_AMOUNT and no quote.");
    process.exitCode = 1;
  }
}

function paymentRequired(response: Response, body: unknown): { accepts?: Array<Record<string, unknown>> } | null {
  const header = response.headers.get("payment-required");
  if (header) {
    const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8")) as { accepts?: Array<Record<string, unknown>> };
    return decoded;
  }
  if (body && typeof body === "object" && "paymentRequired" in body) return body.paymentRequired as { accepts?: Array<Record<string, unknown>> };
  return null;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text) as unknown; } catch { return text; }
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
