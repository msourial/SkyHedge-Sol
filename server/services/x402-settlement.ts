import { prepareRpcUrls } from "./rpc-failover.js";

/** A Devnet signature read. `unknown` means the RPC did not answer; it is not proof the transfer failed. */
export type SignatureView = "confirmed" | "failed" | "submitted" | "absent" | "unknown";

const SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{64,128}$/;
const CONFIRM_DELAYS_MS = [0, 400, 900, 1_600] as const;
const ATTEMPT_MS = 2_000;
export const CONFIRM_DEADLINE_MS = 8_000;
/** A Devnet blockhash expires in about a minute. After this, an absent signature will not land. */
export const BLOCKHASH_WINDOW_MS = 90_000;

export function devnetExplorerTx(signature: string): string {
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=devnet`;
}

/**
 * Confirmation failed or never arrived. The transfer may still land.
 * A definitive reject (wrong amount, insufficient funds, an on-chain error) is not ambiguous.
 */
export function isAmbiguousSettlement(reason?: string, message?: string): boolean {
  return /settlement_pending|settlement_timeout|429|too many requests|rate limit|timed out|timeout|unable to confirm|not confirmed|blockhash not found/i.test(`${reason ?? ""}\n${message ?? ""}`);
}

export function parseSignatureStatus(payload: unknown): SignatureView {
  if (!payload || typeof payload !== "object") return "unknown";
  const result = (payload as { result?: { value?: unknown[] } }).result;
  if (!result || !Array.isArray(result.value)) return "unknown";
  const row = result.value[0];
  if (row == null) return "absent";
  if (typeof row !== "object") return "unknown";
  const status = row as { err?: unknown; confirmationStatus?: string };
  if (status.err) return "failed";
  if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") return "confirmed";
  return "submitted";
}

/**
 * Whether the agent may sign a new transfer. A submitted, confirmed, or unanswered signature is reused.
 * Paying again is allowed only when nothing was broadcast, or the chain shows the transfer failed or expired.
 */
export function nextPaymentAction(input: { hasAttempt: boolean; ageMs: number; view: SignatureView | null }): "pay" | "reuse" {
  if (!input.hasAttempt) return "pay";
  if (input.view === "failed") return "pay";
  if ((input.view === "absent" || input.view === null) && input.ageMs > BLOCKHASH_WINDOW_MS) return "pay";
  return "reuse";
}

export async function observeDevnetSignature(
  signature: string,
  options: {
    urls?: readonly string[];
    fetch?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
    deadlineMs?: number;
  } = {},
): Promise<SignatureView> {
  if (!SIGNATURE.test(signature)) return "unknown";
  const urls = options.urls ?? prepareRpcUrls();
  const fetchImpl = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const deadline = now() + (options.deadlineMs ?? CONFIRM_DEADLINE_MS);
  let sawAbsent = false;
  let sawUnknown = false;

  for (const delay of CONFIRM_DELAYS_MS) {
    if (delay > 0) {
      if (now() >= deadline) break;
      await sleep(delay);
    }
    for (const url of urls) {
      if (now() >= deadline) break;
      const budget = Math.max(1, Math.min(ATTEMPT_MS, deadline - now()));
      try {
        const view = parseSignatureStatus(await rpcSignatureStatus(fetchImpl, url, signature, budget));
        if (view === "confirmed" || view === "failed") return view;
        if (view === "absent") sawAbsent = true;
        else if (view === "submitted") return "submitted";
        else sawUnknown = true;
      } catch {
        sawUnknown = true;
      }
    }
  }
  if (sawUnknown && !sawAbsent) return "unknown";
  return sawAbsent ? "absent" : "unknown";
}

async function rpcSignatureStatus(fetchImpl: typeof fetch, url: string, signature: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignatureStatuses",
        params: [[signature], { searchTransactionHistory: true }],
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Devnet RPC did not answer.");
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
