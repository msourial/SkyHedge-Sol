import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { approveInPhantomLabel, handleConfirmApprove } from "./confirm-buy.ts";

describe("confirm sheet", () => {
  it("tapping Approve in Phantom starts open_position and does not switch tabs", () => {
    const calls: string[] = [];
    handleConfirmApprove({
      close: () => calls.push("close"),
      signOpenPosition: () => calls.push("sign"),
    });
    assert.deepEqual(calls, ["close", "sign"]);
    assert.equal(approveInPhantomLabel("24.00"), "Approve in Phantom · pay 24.00 SKYT");

    const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    const sheetStart = app.indexOf("signOpenPosition: () => { void submitApprovedAction(\"open_position\"");
    const sheet = app.slice(sheetStart, sheetStart + 220);
    assert.match(sheet, /submitApprovedAction\("open_position", pending\.market, pending\.amount\)/);
    assert.doesNotMatch(sheet, /setTab/);

    const view = readFileSync(new URL("./v2.tsx", import.meta.url), "utf8");
    const cover = view.slice(view.indexOf("export function ConfirmCover"), view.indexOf("function BuyProgress"));
    assert.match(cover, /approveInPhantomLabel\(props\.pay\)/);
    assert.match(cover, /onPress=\{props\.onApprove\}/);
    assert.doesNotMatch(cover, /does not sign/i);
    assert.doesNotMatch(cover, /setTab/);
  });
});
