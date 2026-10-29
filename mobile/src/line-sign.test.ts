import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ApiError } from "./api.ts";
import { TransactionFailedError } from "./buy-phase.ts";
import { signFailure, signStepForPhase, submitLineOpenPosition, type LineSubmitPhase } from "./line-submit.ts";
import { signCopy, type SignContext, type SignState } from "../../shared/ui-sign.ts";
import type { ChainProtection } from "./positions.ts";

const context: SignContext = { premiumBase: "24000000", balanceBase: "50000000", cityName: "New York", peril: "rain", triggerLabel: "102 mm or more", windowLabel: "Nov 1 to Dec 1" };
const position = { market: "rung-market" } as ChainProtection;
function setup(overrides: Partial<Parameters<typeof submitLineOpenPosition>[0]> = {}) {
  const calls = { prepare: 0, sign: 0, check: 0, refresh: 0, signatures: [] as string[], phases: [] as LineSubmitPhase[], duplicates: [] as boolean[], logs: [] as unknown[] };
  const input: Parameters<typeof submitLineOpenPosition>[0] = {
    target: { market: "rung-market", amount: "100000000", premiumBase: "24000000", salesCloseAt: "2026-11-01" },
    wallet: "owner", sessionAddress: "owner", reviewWallet: "owner", positions: [], balanceBase: "50000000", nowSeconds: Date.parse("2026-10-26") / 1000,
    prepare: async (target, wallet) => { calls.prepare++; assert.equal(target.amount, "100000000"); return { network: "devnet", market: target.market, wallet, base64: "prepared" }; },
    sign: async (base64, onPhase) => { calls.sign++; assert.equal(base64, "prepared"); onPhase("waiting"); onPhase("sending"); onPhase("confirming"); return "signature"; },
    check: async (duplicate) => { calls.check++; calls.duplicates.push(duplicate); return false; },
    refresh: async () => { calls.refresh++; }, onPhase: (phase) => calls.phases.push(phase), onSignature: (signature) => calls.signatures.push(signature), logError: (reason) => calls.logs.push(reason), ...overrides,
  };
  return { input, calls };
}

test("Line submits its rung quote without any v2 quote, amount mode, active window, or payment reason", async () => {
  const { input, calls } = setup();
  assert.deepEqual(await submitLineOpenPosition(input), { kind: "confirmed" });
  assert.deepEqual(calls.phases, ["preparing", "waiting", "sending", "confirming"]);
  assert.deepEqual(calls.signatures, ["signature"]);
  assert.equal(calls.refresh, 1);
  assert.equal(calls.check, 0);
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const lineBranch = app.slice(app.indexOf('if (action === "open_position" && lineRequest)'), app.indexOf('const targetMarket =', app.indexOf('if (action === "open_position" && lineRequest)')));
  assert.match(lineBranch, /submitLineOpenPosition/);
  for (const legacy of ["amountMode", "protectionUnavailableReason", "quotePaymentReason", "activeWindow", "requestProtectionQuote"]) assert.ok(!lineBranch.includes(legacy));
});

test("already-covered is a structured outcome and never prepares or silently returns", async () => {
  const { input, calls } = setup({ positions: [position] });
  assert.deepEqual(await submitLineOpenPosition(input), { kind: "already-covered" });
  assert.equal(calls.prepare, 0);
  assert.equal(calls.sign, 0);
  assert.equal(signCopy({ status: "error", kind: "already-covered" }, context).body, "You already have cover for this window.");
});

for (const [name, override, expected] of [
  ["wallet disconnected", { wallet: null }, "other"],
  ["wallet changed since review", { reviewWallet: "different" }, "other"],
  ["session wallet mismatch", { sessionAddress: "different" }, "other"],
  ["invalid amount", { target: { market: "rung-market", amount: "1.5", premiumBase: "24000000", salesCloseAt: "2026-11-01" } }, "other"],
  ["invalid premium", { target: { market: "rung-market", amount: "100000000", premiumBase: "0", salesCloseAt: "2026-11-01" } }, "other"],
  ["sales closed while reviewing", { nowSeconds: Date.parse("2026-11-01") / 1000 }, "closed"],
  ["insufficient SKYT", { balanceBase: "23999999" }, "insufficient"],
] as const) test(`guard surfaces: ${name}`, async () => {
  const { input, calls } = setup(override);
  const outcome = await submitLineOpenPosition(input);
  assert.equal(outcome.kind, "error");
  if (outcome.kind === "error") assert.equal(outcome.error, expected);
  assert.equal(calls.prepare, 0);
  assert.equal(calls.sign, 0);
});

for (const field of ["network", "market", "wallet"] as const) test(`rejects prepared ${field} mismatch before wallet`, async () => {
  const { input, calls } = setup({ prepare: async () => ({ network: "devnet", market: "rung-market", wallet: "owner", base64: "prepared", [field]: "wrong" }) });
  const result = await submitLineOpenPosition(input);
  assert.equal(result.kind, "error");
  assert.equal(calls.sign, 0);
});

for (const [message, expected, reached] of [
  ["User rejected the request", "declined", true],
  ["Insufficient SKYT funds", "insufficient", false],
  ["Position opening window closed (6012)", "closed", false],
  ["Wallet coverage cap exceeded (6014)", "cap", false],
  ["Confirmation timed out", "unconfirmed", true],
  ["Network request failed", "unconfirmed", false],
  ["Unexpected wallet transport failure", "unconfirmed", true],
  ["Refresh the cover quote before approving", "other", false],
] as const) test(`failure maps to sheet: ${expected} / ${message}`, async () => {
  const { input, calls } = setup({ sign: async (_base64, onPhase) => { if (reached) onPhase("waiting"); throw new Error(message); } });
  const result = await submitLineOpenPosition(input);
  assert.equal(result.kind, "error");
  if (result.kind === "error") assert.equal(result.error, expected);
  if (expected === "declined") assert.equal(calls.check, 0);
  else assert.equal(calls.check, reached ? 1 : 0);
  assert.equal(calls.logs.length, 1);
});

test("duplicate errors are already-covered even when chain reads lag", async () => {
  const { input, calls } = setup({ prepare: async () => { throw new ApiError("Could not prepare", "account already in use"); } });
  assert.deepEqual(await submitLineOpenPosition(input), { kind: "already-covered" });
  assert.deepEqual(calls.duplicates, [true]);
});

test("mapped prepare failure retains program detail for classification", () => {
  const result = signFailure(new ApiError("Could not prepare", "Position opening window closed (6012)"), false);
  assert.equal(result.kind === "error" && result.error, "closed");
});

test("chain evidence resolves a send timeout as confirmed and preserves signature", async () => {
  const { input, calls } = setup({ sign: async (_base64, onPhase) => { onPhase("waiting"); onPhase("sending"); throw new TransactionFailedError("Timed out", "sent-signature"); }, check: async () => true });
  assert.deepEqual(await submitLineOpenPosition(input), { kind: "confirmed" });
  assert.deepEqual(calls.signatures, ["sent-signature"]);
  assert.equal(calls.refresh, 1);
});

test("unavailable after-send chain check stays unconfirmed", async () => {
  const { input } = setup({ sign: async (_base64, onPhase) => { onPhase("waiting"); throw new Error("Confirmation timed out"); }, check: async () => { throw new Error("RPC offline"); } });
  const result = await submitLineOpenPosition(input);
  assert.equal(result.kind === "error" && result.error, "unconfirmed");
  assert.doesNotMatch(signCopy({ status: "error", kind: "unconfirmed" }, context).body, /nothing was charged/i);
});

test("refresh failures cannot turn a confirmed send into an error", async () => {
  const { input } = setup({ refresh: async () => { throw new Error("offline"); } });
  assert.deepEqual(await submitLineOpenPosition(input), { kind: "confirmed" });
});

test("phase labels follow the signer callbacks", () => {
  assert.deepEqual(["preparing", "waiting", "sending", "confirming"].map((phase) => signStepForPhase(phase as LineSubmitPhase)), ["wallet", "wallet", "send", "confirm"]);
  const wallet = readFileSync(new URL("./wallet.ts", import.meta.url), "utf8");
  assert.ok(wallet.indexOf('input.onPhase?.("confirming")') < wallet.indexOf('await connection.confirmTransaction'));
});

test("every sheet state has exactly one primary and safe dismissal rules", () => {
  const states: SignState[] = [{ status: "review" }, ...(["wallet", "send", "confirm"] as const).map((step) => ({ status: "progress", step } as const)), { status: "success" }, ...(["declined", "insufficient", "closed", "already-covered", "cap", "unconfirmed", "other"] as const).map((kind) => ({ status: "error", kind } as const))];
  for (const state of states) {
    const copy = signCopy(state, context);
    assert.ok(copy.primary.label);
    assert.ok(!Array.isArray(copy.primary));
    assert.equal(copy.canDismiss, state.status === "review" || state.status === "error");
    assert.equal(Boolean(copy.primary.disabled), state.status === "progress");
    if (copy.secondary) assert.ok(["close", "done"].includes(copy.secondary.action));
  }
});

test("Protect has one entry CTA and no inline sign block or wallet-approval CTA", () => {
  const screen = readFileSync(new URL("./line/ProtectLine.tsx", import.meta.url), "utf8");
  const sheet = readFileSync(new URL("./line/SignSheet.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(screen, /APPROVE_WALLET|Approve in your wallet|Approve in wallet|sheet === "sign"|onApprove/);
  const entry = screen.slice(screen.indexOf("export function LinePay"), screen.indexOf("export function MoneyCells"));
  assert.equal((entry.match(/style=\{\[ui\.cta,/g) ?? []).length, 1);
  assert.match(screen, /pointerEvents=\{props.sheetOpen \? "none"/);
  assert.match(screen, /accessibilityElementsHidden=\{props.sheetOpen\}/);
  assert.equal((sheet.match(/style=\{\[styles\.primary,/g) ?? []).length, 1);
  assert.match(sheet, /<Modal transparent visible/);
  assert.match(sheet, /isReduceMotionEnabled/);
  assert.match(sheet, /onRequestClose=\{dismiss\}/);
  assert.match(sheet, /signCopy\(state, review.context\).canDismiss/);
  const protect = app.slice(app.indexOf('tab === "protect" && !('), app.indexOf('tab === "wallet" ?'));
  assert.doesNotMatch(protect, /FirstRunStrip/);
  assert.ok(app.indexOf("<LinePay") > app.indexOf("</ScrollView>"));
  assert.match(app, /review.target.market, review.target.amount, \{ review, onStep \}/);
});
