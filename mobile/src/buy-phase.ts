import { prepareFailure } from "../../shared/prepare-failure.ts";

export type BuyPhase = "preparing" | "waiting" | "sending" | "confirmed" | "failed";

const PROGRAM_ERRORS: Record<number, string> = {
  6000: "Protocol is paused",
  6001: "Invalid market parameters",
  6002: "Invalid authority",
  6003: "Invalid probability",
  6004: "Invalid premium",
  6005: "Invalid observation window",
  6006: "Invalid amount",
  6007: "Invalid market status",
  6008: "Insufficient liquidity",
  6009: "Liquidity cap exceeded",
  6010: "Insufficient LP shares",
  6011: "Liquidity funding window closed",
  6012: "Position opening window closed",
  6013: "Position opening window is still open",
  6014: "Wallet coverage cap exceeded",
  6015: "Observation period not finished",
  6016: "Unauthorised settlement authority",
  6017: "Invalid observation time",
  6018: "Settlement observation is stale",
  6019: "Data deadline has not been reached",
  6020: "Claim window has closed",
  6021: "Claim window is still open",
  6022: "Position is not claimable",
  6023: "Position is not refundable",
  6024: "Payout already claimed",
  6025: "Refund already claimed",
  6026: "Liquidity already redeemed",
  6027: "Oracle station does not match the market pin",
  6028: "Oracle methodology does not match the market commitment",
  6029: "Invalid NOAA observation payload",
  6030: "Arithmetic overflow",
  6031: "Draft market is not empty and cannot be cancelled",
};

export class TransactionFailedError extends Error {
  readonly signature?: string;
  constructor(message: string, signature?: string) {
    super(message);
    this.name = "TransactionFailedError";
    this.signature = signature;
  }
}

export function customerPrepareError(message: string, detail?: string | null): { message: string; detail: string | null } {
  const raw = detail || message;
  const prepared = prepareFailure(new Error(raw));
  const friendly = prepared.message === raw ? message : prepared.message;
  return { message: friendly, detail: raw !== friendly ? raw : null };
}

export function buyPhaseLabel(phase: BuyPhase): string {
  switch (phase) {
    case "preparing": return "Preparing your protection…";
    case "waiting": return "Waiting for approval";
    case "sending": return "Sending";
    case "confirmed": return "Confirmed";
    case "failed": return "Failed";
  }
}

export function describeChainError(err: unknown): string {
  const code = findCustomCode(err);
  if (code != null) {
    const msg = PROGRAM_ERRORS[code];
    return msg ? `${msg} (${code})` : `Program error ${code}`;
  }
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err && typeof err === "object") {
    try {
      const text = JSON.stringify(err);
      if (text && text !== "{}") return text;
    } catch { /* fall through */ }
  }
  return "The transaction failed.";
}

export const PHANTOM_NO_ANSWER = "Phantom didn't answer. Nothing was sent. Unlock Phantom, then tap Approve in Phantom again.";

/** Wallet-side failures. These are not Devnet problems, so they never become "Devnet is busy". */
export function walletFailure(message: string): string | null {
  if (/Timed out waiting for response|TimeoutException|session closed|no installed wallet|ERROR_WALLET_NOT_FOUND|Found no installed wallet/i.test(message)) return PHANTOM_NO_ANSWER;
  if (/user rejected|declined|cancell?ed by user|authorization request failed/i.test(message)) return "You declined the request in Phantom. Nothing was sent.";
  return null;
}

/** Message and Details for the Failed card: wallet errors first, then the prepare mapping. */
export function transactionFailure(message: string, apiDetail: string | null): { message: string; detail: string | null } {
  const wallet = walletFailure(message);
  if (wallet) return { message: wallet, detail: message };
  return customerPrepareError(visibleTransactionError(message), apiDetail);
}

export function visibleTransactionError(message: string): string {
  const wallet = walletFailure(message);
  if (wallet) return wallet;
  const line = message.split("\n").map((part) => part.trim()).find((part) => part && !/^at /.test(part)) ?? message;
  return line.length > 300 ? `${line.slice(0, 297)}…` : line;
}

function findCustomCode(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  if ("Custom" in err && typeof (err as { Custom: unknown }).Custom === "number") return (err as { Custom: number }).Custom;
  const values = Array.isArray(err) ? err : Object.values(err as Record<string, unknown>);
  for (const value of values) {
    const found = findCustomCode(value);
    if (found != null) return found;
  }
  return null;
}
