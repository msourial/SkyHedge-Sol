/** Pure sign-sheet states. The host performs actions and reports every outcome. */
import * as copy from "./ui-copy.ts";
import { formatBase } from "./ui-money.ts";
import { MARKET_CAP_SKYT } from "./ui-tokens.ts";
import type { PerilId } from "./ui-types.ts";

export type SignErrorKind = "declined" | "insufficient" | "closed" | "already-covered" | "cap" | "unconfirmed" | "other";
export type SignStep = "wallet" | "send" | "confirm";
export type SignState =
  | { status: "review" }
  | { status: "progress"; step: SignStep }
  | { status: "success" }
  | { status: "error"; kind: SignErrorKind };
export type SignOutcome =
  | { kind: "confirmed" }
  | { kind: "already-covered" }
  | { kind: "error"; error: SignErrorKind; message?: string; detail?: string | null };
export type SignContext = {
  /** Integer base units from the frozen rung quote, never a displayed multiple. */
  premiumBase: string;
  balanceBase: string | null;
  cityName: string;
  peril: PerilId;
  triggerLabel: string;
  windowLabel: string;
};
export type SignAction = "approve" | "retry" | "close" | "markets" | "wallet" | "done" | "wait";
export type SignButton = { label: string; action: SignAction; disabled?: boolean };
export type SignCopy = {
  title: string;
  body: string;
  primary: SignButton;
  secondary: SignButton | null;
  canDismiss: boolean;
  steps: Array<{ step: SignStep; label: string; state: "done" | "active" | "pending" }>;
};

function baseLabel(raw: string): string {
  if (!/^\d+$/.test(raw)) throw new Error("Expected non-negative integer base units");
  return formatBase(BigInt(raw));
}

export function signCopy(state: SignState, ctx: SignContext): SignCopy {
  const common = { steps: [] as SignCopy["steps"], canDismiss: true };
  if (state.status === "review") return { ...common, title: copy.SIGN_REVIEW_TITLE, body: copy.signContextLine(ctx.cityName, ctx.peril),
    primary: { label: copy.SIGN_APPROVE, action: "approve" }, secondary: { label: copy.CANCEL, action: "close" } };
  if (state.status === "progress") {
    const order: SignStep[] = ["wallet", "send", "confirm"];
    const labels = [copy.APPROVE_WALLET, copy.SENDING_DEVNET, copy.CONFIRMING];
    const active = order.indexOf(state.step);
    return { title: copy.COVERING, body: copy.KEEP_CHECKING, canDismiss: false,
      primary: { label: state.step === "wallet" ? copy.WAITING_WALLET : copy.CONFIRMING_DEVNET, action: "wait", disabled: true }, secondary: null,
      steps: order.map((step, index) => ({ step, label: labels[index], state: index < active ? "done" : index === active ? "active" : "pending" })) };
  }
  if (state.status === "success") return { ...common, canDismiss: false, title: copy.COVERED_WORD, body: copy.signSuccessLine(ctx.triggerLabel, ctx.windowLabel),
    primary: { label: copy.VIEW_WALLET, action: "wallet" }, secondary: { label: copy.DONE, action: "done" } };
  const title = copy.SIGN_ERRORS[state.kind].title;
  switch (state.kind) {
    case "declined": return { ...common, title, body: copy.SIGN_ERRORS.declined.body, primary: { label: copy.TRY_AGAIN, action: "retry" }, secondary: { label: copy.CLOSE, action: "close" } };
    case "insufficient": return { ...common, title, body: copy.signBalanceLine(baseLabel(ctx.premiumBase), ctx.balanceBase == null ? null : baseLabel(ctx.balanceBase)), primary: { label: copy.CLOSE, action: "close" }, secondary: null };
    case "closed": return { ...common, title, body: copy.SIGN_ERRORS.closed.body, primary: { label: copy.BACK_MARKETS, action: "markets" }, secondary: null };
    case "already-covered": return { ...common, title, body: copy.ALREADY_COVERED, primary: { label: copy.VIEW_WALLET, action: "wallet" }, secondary: null };
    case "cap": return { ...common, title, body: copy.signCapLine(), primary: { label: copy.CLOSE, action: "close" }, secondary: null };
    case "unconfirmed": case "other": return { ...common, title, body: copy.SIGN_ERRORS[state.kind].body, primary: { label: copy.OPEN_WALLET, action: "wallet" }, secondary: { label: copy.CLOSE, action: "close" } };
  }
}

/** Raw messages are only classifier input, never sheet copy. */
export function classifySignError(input: { message: string; detail?: string | null; reachedWallet: boolean; duplicate: boolean }): SignErrorKind {
  const text = `${input.message} ${input.detail ?? ""}`.toLowerCase();
  if (input.duplicate || /already[ -]covered|already.*(?:cover|position)|existing position|duplicate|position.*(?:exists|opened)/.test(text)) return "already-covered";
  // A rejection is definitive only after a wallet request. A network failure
  // mentioning rejection is still uncertain and must never promise no charge.
  if (input.reachedWallet && /user.*(?:reject|declin|cancel)|(?:reject|declin|cancel).*(?:user|wallet)|not approved|^declined\b|^rejected\b/.test(text)) return "declined";
  if (/insufficient|not enough.*(?:skyt|fund|balance)|balance too low/.test(text)) return "insufficient";
  if (/sales.*clos|just closed|window.*clos|market.*clos|^closed\b/.test(text)) return "closed";
  if (/\bcap\b|capexceeded|cover limit|market limit/.test(text)
    || new RegExp(`\\b${MARKET_CAP_SKYT}\\b.*skyt|skyt.*\\b${MARKET_CAP_SKYT}\\b`).test(text)) return "cap";
  if (/network|time[ -]?out|timed out|confirm|devnet|offline|fetch failed|failed to fetch|blockhash|rpc/.test(text)) return "unconfirmed";
  return "other";
}

export type SignEvent =
  | { type: "approve" | "wallet-approved" | "sent" | "retry" }
  | { type: "outcome"; outcome: SignOutcome };
/** Ignore stale or out-of-order progress; one attempt cannot restart itself. */
export function transitionSign(state: SignState, event: SignEvent): SignState {
  if (event.type === "approve" && state.status === "review") return { status: "progress", step: "wallet" };
  if (event.type === "wallet-approved" && state.status === "progress" && state.step === "wallet") return { status: "progress", step: "send" };
  if (event.type === "sent" && state.status === "progress" && state.step === "send") return { status: "progress", step: "confirm" };
  if (event.type === "retry" && state.status === "error" && state.kind === "declined") return { status: "review" };
  if (event.type === "outcome" && (state.status === "progress" || state.status === "review")) {
    if (event.outcome.kind === "confirmed") return { status: "success" };
    return { status: "error", kind: event.outcome.kind === "already-covered" ? "already-covered" : event.outcome.error };
  }
  return state;
}
