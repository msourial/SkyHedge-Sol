import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { APP_IDENTITY } from "./wallet-identity.ts";

describe("MWA identity", () => {
  it("names SkyHedge at its deployed site with a relative icon", () => {
    assert.equal(APP_IDENTITY.name, "SkyHedge");
    assert.equal(APP_IDENTITY.uri, "https://skyhedge.vercel.app");
    assert.equal(APP_IDENTITY.icon, "favicon.svg");
    assert.equal(new URL(APP_IDENTITY.icon, `${APP_IDENTITY.uri}/`).href, "https://skyhedge.vercel.app/favicon.svg");
  });
});
