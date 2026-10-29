import assert from "node:assert/strict";
import { test } from "node:test";
import { forbiddenHits } from "./ui-copy.ts";
import { MARKET_CAP_SKYT } from "./ui-tokens.ts";
import { classifySignError, signCopy, transitionSign, type SignContext, type SignErrorKind, type SignState } from "./ui-sign.ts";

const CTX: SignContext = { premiumBase: "24000000", balanceBase: "12345678", cityName: "New York", peril: "rain", triggerLabel: "102 mm or more", windowLabel: "Nov 1 to Dec 1" };
const ERRORS: Array<{ kind: SignErrorKind; message: string; detail?: string; duplicate?: boolean; body: string; primary: string; action: string; secondary: string | null }> = [
  { kind: "declined", message: "User rejected the request", body: "You didn't approve it. Nothing was charged.", primary: "Try again", action: "retry", secondary: "Close" },
  { kind: "insufficient", message: "Insufficient token balance", body: "You need 24.00 SKYT and have 12.34 SKYT.", primary: "Close", action: "close", secondary: null },
  { kind: "closed", message: "This window just closed", body: "Sales for this window closed.", primary: "Back to Markets", action: "markets", secondary: null },
  { kind: "already-covered", message: "Existing position for wallet", duplicate: true, body: "You already have cover for this window.", primary: "View in Wallet", action: "wallet", secondary: null },
  { kind: "cap", message: "Market cover cap reached", body: `Cover limit reached: ${MARKET_CAP_SKYT} SKYT for this market.`, primary: "Close", action: "close", secondary: null },
  { kind: "unconfirmed", message: "Network timeout while confirming", body: "We couldn't confirm it. Check Wallet before you try again.", primary: "Open Wallet", action: "wallet", secondary: "Close" },
  { kind: "other", message: "Unexpected response", detail: "Private raw error never rendered", body: "Something went wrong. Check Wallet before you try again.", primary: "Open Wallet", action: "wallet", secondary: "Close" },
];

test("all seven error kinds are reachable and return the exact spec copy and actions", () => {
  assert.equal(new Set(ERRORS.map((fixture) => fixture.kind)).size, 7);
  for (const fixture of ERRORS) {
    const kind = classifySignError({ ...fixture, reachedWallet: true, duplicate: fixture.duplicate ?? false });
    assert.equal(kind, fixture.kind);
    const view = signCopy({ status: "error", kind }, CTX);
    assert.equal(view.body, fixture.body);
    assert.equal(view.primary.label, fixture.primary);
    assert.equal(view.primary.action, fixture.action);
    assert.equal(view.secondary?.label ?? null, fixture.secondary);
    assert.equal(view.canDismiss, true);
    assert.equal(JSON.stringify(view).includes("Private raw error"), false);
    assert.deepEqual(forbiddenHits(JSON.stringify(view)), []);
  }
});

test("every review, progress, success and error state has exactly one primary", () => {
  const states: SignState[] = [{ status: "review" }, ...(["wallet", "send", "confirm"] as const).map((step) => ({ status: "progress" as const, step })),
    { status: "success" }, ...ERRORS.map(({ kind }) => ({ status: "error" as const, kind }))];
  for (const state of states) {
    const view = signCopy(state, CTX);
    const primaries = Object.entries(view).filter(([key, value]) => key === "primary" && !!value && !Array.isArray(value));
    assert.equal(primaries.length, 1);
    assert.equal(typeof view.primary.label, "string"); assert(view.primary.label.length > 0);
    assert.equal(typeof view.primary.action, "string");
    if (view.secondary) assert.notEqual(view.secondary.label, view.primary.label);
    assert.deepEqual(forbiddenHits(JSON.stringify(view)), []);
  }
});

test("review and success have the spec titles, context and single actions", () => {
  const review = signCopy({ status: "review" }, CTX);
  assert.equal(review.title, "Review your cover"); assert.equal(review.body, "New York . Rain . Devnet");
  assert.deepEqual(review.primary, { label: "Approve in wallet", action: "approve" });
  assert.deepEqual(review.secondary, { label: "Cancel", action: "close" }); assert.equal(review.canDismiss, true);
  const success = signCopy({ status: "success" }, CTX);
  assert.equal(success.title, "Covered"); assert.equal(success.body, "Trigger 102 mm or more . Nov 1 to Dec 1");
  assert.deepEqual(success.primary, { label: "View in Wallet", action: "wallet" });
  assert.deepEqual(success.secondary, { label: "Done", action: "done" }); assert.equal(success.canDismiss, false);
});

test("progress advances the three rows in place, disables the CTA and cannot dismiss", () => {
  for (const [index, step] of (["wallet", "send", "confirm"] as const).entries()) {
    const view = signCopy({ status: "progress", step }, CTX);
    assert.equal(view.title, "Covering"); assert.equal(view.body, "You can leave this screen. We'll keep checking.");
    assert.equal(view.primary.label, step === "wallet" ? "Waiting for your wallet" : "Confirming on Devnet");
    assert.equal(view.primary.disabled, true); assert.equal(view.primary.action, "wait");
    assert.equal(view.secondary, null); assert.equal(view.canDismiss, false);
    assert.deepEqual(view.steps.map((row) => row.label), ["Approve in your wallet", "Sending to Devnet", "Confirming"]);
    assert.deepEqual(view.steps.map((row, rowIndex) => row.state), view.steps.map((_, rowIndex) => rowIndex < index ? "done" : rowIndex === index ? "active" : "pending"));
  }
});

test("balance and needed amount use integer base units, including values beyond safe number precision", () => {
  const error: SignState = { status: "error", kind: "insufficient" };
  assert.equal(signCopy(error, { ...CTX, premiumBase: "24691357", balanceBase: "0" }).body, "You need 24.69 SKYT and have 0.00 SKYT.");
  assert.equal(signCopy(error, { ...CTX, balanceBase: "9007199254740993123456" }).body, "You need 24.00 SKYT and have 9007199254740993.12 SKYT.");
  assert.equal(signCopy(error, { ...CTX, balanceBase: null }).body, "You need 24.00 SKYT. Your balance is unavailable.");
  assert.throws(() => signCopy(error, { ...CTX, premiumBase: "24.00" }), /integer base units/);
});

test("classifier reads detail, honours duplicates, and distinguishes uncertain outcomes from a wallet decline", () => {
  const classify = (message: string, detail?: string, reachedWallet = true) => classifySignError({ message, detail, reachedWallet, duplicate: false });
  for (const message of ["User declined", "Cancelled by user", "Wallet request rejected by user", "Not approved"]) assert.equal(classify(message), "declined");
  for (const message of ["Sales closed", "Market closed", "Closed"]) assert.equal(classify(message), "closed");
  for (const message of ["Duplicate", "You already have cover", "Position already exists"]) assert.equal(classify(message), "already-covered");
  for (const message of ["500 SKYT limit", "Market cap exceeded"]) assert.equal(classify(message), "cap");
  for (const message of ["Failed to fetch", "RPC unavailable", "Confirmation expired", "Network rejected connection", "Transaction timed out"]) assert.equal(classify(message), "unconfirmed");
  assert.equal(classify("Request failed", "insufficient funds"), "insufficient");
  assert.equal(classify("User rejected request", undefined, false), "other");
  assert.equal(classifySignError({ message: "unknown", reachedWallet: false, duplicate: true }), "already-covered");
  for (const kind of ["unconfirmed", "other"] as const) assert.doesNotMatch(signCopy({ status: "error", kind }, CTX).body, /nothing was charged/i);
});

test("state machine handles confirmation, silent duplicate exits, every error, retry and stale events", () => {
  let state: SignState = { status: "review" };
  assert.deepEqual(transitionSign(state, { type: "sent" }), state);
  state = transitionSign(state, { type: "approve" }); assert.deepEqual(state, { status: "progress", step: "wallet" });
  assert.deepEqual(transitionSign(state, { type: "approve" }), state);
  state = transitionSign(state, { type: "wallet-approved" }); assert.deepEqual(state, { status: "progress", step: "send" });
  state = transitionSign(state, { type: "sent" }); assert.deepEqual(state, { status: "progress", step: "confirm" });
  state = transitionSign(state, { type: "outcome", outcome: { kind: "confirmed" } }); assert.deepEqual(state, { status: "success" });
  assert.deepEqual(transitionSign(state, { type: "outcome", outcome: { kind: "error", error: "unconfirmed" } }), state);
  assert.deepEqual(transitionSign({ status: "review" }, { type: "outcome", outcome: { kind: "already-covered" } }), { status: "error", kind: "already-covered" });
  for (const { kind } of ERRORS) {
    const error = transitionSign({ status: "progress", step: "wallet" }, { type: "outcome", outcome: { kind: "error", error: kind } });
    assert.deepEqual(error, { status: "error", kind });
    assert.deepEqual(transitionSign(error, { type: "retry" }), kind === "declined" ? { status: "review" } : error);
  }
});
