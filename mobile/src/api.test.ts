import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { claimReadinessPath, isNonJsonReply } from "./api.ts";

describe("mobile API replies", () => {
  it("treats an HTML reply as not available yet", () => {
    assert.equal(isNonJsonReply("text/html; charset=utf-8", "<!doctype html>"), true);
    assert.equal(isNonJsonReply(null, "  <html>"), true);
    assert.equal(isNonJsonReply("application/json", "{\"state\":\"open\"}"), false);
  });
  it("reads claim readiness through the combined mobile endpoint", () => {
    assert.equal(claimReadinessPath("M1", "W 2"), "/api/mobile?resource=claim-readiness&market=M1&wallet=W%202");
  });
});
