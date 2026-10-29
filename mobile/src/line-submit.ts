import { classifySignError, type SignOutcome, type SignStep } from "../../shared/ui-sign.ts";
import { ApiError } from "./api.ts";
import { TransactionFailedError, transactionFailure } from "./buy-phase.ts";
import { isExistingPositionError, isWalletDecline, positionForWindow } from "./covered.ts";
import { friendlyError } from "./friendly-errors.ts";
import type { ChainProtection } from "./positions.ts";

export type LineSubmitTarget = { market: string; amount: string; premiumBase: string; salesCloseAt: string };
export type LineSubmitPhase = "preparing" | "waiting" | "sending" | "confirming";
type Prepared = { network: string; market: string; wallet: string; base64: string };

export function signStepForPhase(phase: LineSubmitPhase): SignStep {
  return phase === "sending" ? "send" : phase === "confirming" ? "confirm" : "wallet";
}

/** Preserve mapped and raw details for classification; renderers only display signCopy. */
export function signFailure(reason: unknown, reachedWallet: boolean): SignOutcome {
  const raw = reason instanceof Error ? reason.message : "The transaction did not complete.";
  const shown = transactionFailure(raw, reason instanceof ApiError ? reason.detail : null);
  const detail = [raw, shown.detail].filter(Boolean).join(" ");
  const duplicate = isExistingPositionError(detail) || isExistingPositionError(shown.message);
  let error = classifySignError({ message: shown.message, detail, duplicate, reachedWallet });
  if (error === "other" && reachedWallet && !(reason instanceof TransactionFailedError && reason.confirmedFailure)) error = "unconfirmed";
  if (error === "already-covered") return { kind: "already-covered" };
  return { kind: "error", error, message: friendlyError(shown.message), detail: shown.detail };
}

/** The Line quote is the only price input. No legacy v2 quote or amount-mode state. */
export async function submitLineOpenPosition(input: {
  target: LineSubmitTarget;
  wallet: string | null;
  sessionAddress: string | null;
  reviewWallet: string | null;
  balanceBase: string | null;
  positions: readonly ChainProtection[] | null;
  nowSeconds: number;
  prepare: (target: LineSubmitTarget, wallet: string) => Promise<Prepared>;
  sign: (base64: string, onPhase: (phase: Exclude<LineSubmitPhase, "preparing">) => void) => Promise<string>;
  check: (duplicate: boolean) => Promise<boolean>;
  onPhase: (phase: LineSubmitPhase) => void;
  onSignature: (signature: string) => void;
  refresh: () => Promise<void>;
  logError: (reason: unknown) => void;
}): Promise<SignOutcome> {
  let reachedWallet = false;
  try {
    if (!input.wallet || input.sessionAddress !== input.wallet || input.reviewWallet !== input.wallet) throw new Error("Connect the reviewed wallet before approving this cover.");
    if (positionForWindow(input.positions, input.target.market)) return { kind: "already-covered" };
    const { market, amount, premiumBase, salesCloseAt } = input.target;
    if (!market || !/^\d+$/.test(amount) || BigInt(amount) <= 0n || !/^\d+$/.test(premiumBase) || BigInt(premiumBase) <= 0n) throw new Error("Refresh the cover quote before approving.");
    if (!Number.isFinite(Date.parse(salesCloseAt))) throw new Error("Refresh the cover quote before approving.");
    if (Date.parse(salesCloseAt) <= input.nowSeconds * 1000) throw new Error("Sales for this window closed.");
    if (input.balanceBase != null && /^\d+$/.test(input.balanceBase) && BigInt(input.balanceBase) < BigInt(premiumBase)) throw new Error("Not enough SKYT.");
    input.onPhase("preparing");
    const unsigned = await input.prepare(input.target, input.wallet);
    if (unsigned.network !== "devnet" || unsigned.market !== market || unsigned.wallet !== input.wallet) throw new Error("The prepared transaction does not match the reviewed wallet or market.");
    const signature = await input.sign(unsigned.base64, (phase) => {
      if (phase === "waiting" || phase === "sending" || phase === "confirming") reachedWallet = true;
      input.onPhase(phase);
    });
    input.onSignature(signature);
    try { await input.refresh(); } catch { /* Confirmed; a later Wallet refresh can retry the read. */ }
    return { kind: "confirmed" };
  } catch (reason) {
    input.logError(reason);
    if (reason instanceof TransactionFailedError && reason.signature) input.onSignature(reason.signature);
    const outcome = signFailure(reason, reachedWallet);
    const duplicate = outcome.kind === "already-covered";
    const raw = reason instanceof Error ? reason.message : "";
    if (input.wallet && input.target.market && (duplicate || (reachedWallet && !isWalletDecline(raw)))) {
      input.onPhase("confirming");
      try {
        if (await input.check(duplicate)) {
          try { await input.refresh(); } catch { /* Chain evidence is sufficient. */ }
          return duplicate ? { kind: "already-covered" } : { kind: "confirmed" };
        }
      } catch { /* An unavailable read is not evidence that nothing was sent. */ }
    }
    return outcome;
  }
}
