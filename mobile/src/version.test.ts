import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { APP_BUILD, APP_VERSION } from "./version.ts";

const root = new URL("../", import.meta.url);
describe("app version", () => {
  it("matches app.json, package.json and the Android build", () => {
    const app = JSON.parse(readFileSync(new URL("app.json", root), "utf8")).expo;
    assert.equal(app.version, APP_VERSION);
    assert.equal(app.android.versionCode, APP_BUILD);
    assert.equal(JSON.parse(readFileSync(new URL("package.json", root), "utf8")).version, APP_VERSION);
    const gradle = readFileSync(new URL("android/app/build.gradle", root), "utf8");
    assert.match(gradle, new RegExp(`versionCode ${APP_BUILD}\\b`));
    assert.match(gradle, new RegExp(`versionName "${APP_VERSION.replace(/\./g, "\\.")}"`));
  });
});
