import { expect } from "chai";
import { ALLOWED_WEB_ORIGINS, PUBLIC_SITE_ORIGIN, isAllowedWebOrigin } from "../../shared/public-origins";
import { applyCorsHeaders, isCorsPreflight } from "./cors";

describe("public origins", () => {
  it("treats skyhedge.app as canonical and keeps the Vercel alias allowlisted", () => {
    expect(PUBLIC_SITE_ORIGIN).to.equal("https://skyhedge.app");
    expect(ALLOWED_WEB_ORIGINS).to.include("https://skyhedge.app");
    expect(ALLOWED_WEB_ORIGINS).to.include("https://www.skyhedge.app");
    expect(ALLOWED_WEB_ORIGINS).to.include("https://skyhedge.vercel.app");
    expect(isAllowedWebOrigin("https://skyhedge.app")).to.equal(true);
    expect(isAllowedWebOrigin("https://evil.example")).to.equal(false);
  });
});

describe("applyCorsHeaders", () => {
  it("reflects allowlisted origins and ignores others", () => {
    const headers: Record<string, string> = {};
    const res = { setHeader(name: string, value: string) { headers[name] = value; } };

    applyCorsHeaders({ headers: { origin: "https://skyhedge.app" } }, res);
    expect(headers["Access-Control-Allow-Origin"]).to.equal("https://skyhedge.app");

    const blocked: Record<string, string> = {};
    applyCorsHeaders({ headers: { origin: "https://evil.example" } }, { setHeader(name, value) { blocked[name] = value; } });
    expect(blocked["Access-Control-Allow-Origin"]).to.equal(undefined);
  });

  it("detects OPTIONS preflight", () => {
    expect(isCorsPreflight({ method: "OPTIONS" })).to.equal(true);
    expect(isCorsPreflight({ method: "GET" })).to.equal(false);
  });
});
