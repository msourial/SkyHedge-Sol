import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { friendlyError, isNetworkError, stationLabel } from "./friendly-errors.ts";

describe("friendly errors", () => {
  it("maps the Seeker UnknownHostException to an offline message", () => {
    const raw = "java.net.UnknownHostException: Unable to resolve host \"skyhedge.vercel.app\": No address associated with hostname";
    assert.ok(isNetworkError(raw));
    assert.match(friendlyError(raw), /offline|can't be reached/);
    assert.doesNotMatch(friendlyError(raw), /java|vercel/);
  });
  it("hides stack-like text but keeps plain product copy", () => {
    assert.equal(friendlyError("TypeError: x is undefined", "Fallback"), "Fallback");
    assert.equal(friendlyError("Select Des Moines first."), "Select Des Moines first.");
  });
  it("never shows raw GHCND ids", () => {
    assert.equal(stationLabel("GHCND:USW00014933"), "Des Moines Intl Airport");
    assert.equal(stationLabel(null), "Station pending");
  });
});
