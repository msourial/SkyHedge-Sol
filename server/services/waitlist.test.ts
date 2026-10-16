import { expect } from "chai";
import {
  createWaitlistCountHandler,
  createWaitlistExportHandler,
  createWaitlistHandler,
  hashWaitlistIp,
  honeypotAckId,
  isValidAdminToken,
  normalizeWaitlistEmail,
  validateWaitlistBody,
  waitlistRowsToCsv,
} from "./waitlist";
import type { ApiResponse } from "./vercel-api.js";

function mockRes() {
  const headers = new Map<string, string>();
  let statusCode = 200;
  let body: unknown;
  let ended: string | undefined;
  const res = {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
      return res;
    },
    status(code: number) {
      statusCode = code;
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      body = payload;
      return res;
    },
    end(payload?: string) {
      ended = payload;
      return res;
    },
  };
  return {
    res: res as unknown as ApiResponse,
    get status() {
      return statusCode;
    },
    get body() {
      return body;
    },
    get ended() {
      return ended;
    },
    get headers() {
      return headers;
    },
  };
}

describe("waitlist validation", () => {
  it("normalizes email case and whitespace", () => {
    expect(normalizeWaitlistEmail("  Alex@SkyHedge.APP ")).to.equal("alex@skyhedge.app");
  });

  it("accepts a valid email and empty honeypot", () => {
    const result = validateWaitlistBody({ email: "tester@example.com", company: "" });
    expect(result.ok).to.equal(true);
    if (!result.ok) return;
    expect(result.emailNormalized).to.equal("tester@example.com");
    expect(result.honeypot).to.equal(false);
  });

  it("parses attribution fields", () => {
    const result = validateWaitlistBody({
      email: "tester@example.com",
      referrer: "https://x.com/skyhedge",
      utmSource: "twitter",
      utmMedium: "social",
      utmCampaign: "seeker",
    });
    expect(result.ok).to.equal(true);
    if (!result.ok) return;
    expect(result.utmSource).to.equal("twitter");
    expect(result.referrer).to.equal("https://x.com/skyhedge");
  });

  it("flags honeypot fills without rejecting the request shape", () => {
    const result = validateWaitlistBody({ email: "bot@example.com", company: "Acme Spam" });
    expect(result.ok).to.equal(true);
    if (!result.ok) return;
    expect(result.honeypot).to.equal(true);
    expect(honeypotAckId(result.emailNormalized)).to.have.length(32);
  });

  it("rejects invalid emails", () => {
    const result = validateWaitlistBody({ email: "not-an-email" });
    expect(result.ok).to.equal(false);
    if (result.ok) return;
    expect(result.error).to.equal("INVALID_EMAIL");
  });
});

describe("waitlist ip hash + admin auth", () => {
  it("hashes IP with salt (never returns raw IP)", () => {
    const a = hashWaitlistIp("1.2.3.4", "salt-a");
    const b = hashWaitlistIp("1.2.3.4", "salt-b");
    expect(a).to.have.length(64);
    expect(a).to.not.equal(b);
    expect(a).to.not.include("1.2.3.4");
  });

  it("validates admin tokens with length and equality checks", () => {
    expect(isValidAdminToken("short", "short")).to.equal(false);
    expect(isValidAdminToken("correct-token-16+", "correct-token-16+")).to.equal(true);
    expect(isValidAdminToken("wrong-token-16chars", "correct-token-16+")).to.equal(false);
    expect(isValidAdminToken(undefined, "correct-token-16+")).to.equal(false);
  });

  it("renders CSV with a header row", () => {
    const csv = waitlistRowsToCsv([
      {
        id: "1",
        email: "a@b.co",
        emailNormalized: "a@b.co",
        source: "landing",
        referrer: null,
        utmSource: "x",
        utmMedium: null,
        utmCampaign: null,
        ipHash: "abc",
        userAgent: "mocha",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    expect(csv.split("\n")[0]).to.include("email_normalized");
    expect(csv).to.include("a@b.co");
  });
});

describe("waitlist handlers", () => {
  it("accepts a valid signup", async () => {
    const inserted: unknown[] = [];
    const handler = createWaitlistHandler({
      getDb: () =>
        ({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [],
              }),
            }),
          }),
          insert: () => ({
            values: async (row: unknown) => {
              inserted.push(row);
            },
          }),
        }) as never,
      ipHashSalt: "test-salt",
    });
    const out = mockRes();
    await handler(
      { method: "POST", body: { email: "new@example.com", company: "" }, headers: { "user-agent": "test" }, ip: "9.9.9.9" },
      out.res,
    );
    expect(out.status).to.equal(200);
    expect(out.body).to.deep.equal({ ok: true, status: "subscribed" });
    expect(inserted).to.have.length(1);
  });

  it("rejects invalid email with 400", async () => {
    const handler = createWaitlistHandler({ getDb: () => null });
    const out = mockRes();
    await handler({ method: "POST", body: { email: "nope" }, headers: {}, ip: "1.1.1.1" }, out.res);
    expect(out.status).to.equal(400);
    expect((out.body as { error: string }).error).to.equal("INVALID_EMAIL");
  });

  it("returns success for duplicates without leaking an error", async () => {
    const handler = createWaitlistHandler({
      getDb: () =>
        ({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [{ id: "existing" }],
              }),
            }),
          }),
          insert: () => ({
            values: async () => {
              throw new Error("should not insert");
            },
          }),
        }) as never,
    });
    const out = mockRes();
    await handler({ method: "POST", body: { email: "dup@example.com" }, headers: {}, ip: "1.1.1.1" }, out.res);
    expect(out.status).to.equal(200);
    expect(out.body).to.deep.equal({ ok: true, status: "subscribed" });
  });

  it("acks honeypot without writing", async () => {
    let wrote = false;
    const handler = createWaitlistHandler({
      getDb: () =>
        ({
          insert: () => ({
            values: async () => {
              wrote = true;
            },
          }),
        }) as never,
    });
    const out = mockRes();
    await handler(
      { method: "POST", body: { email: "bot@example.com", company: "Spam Co" }, headers: {}, ip: "1.1.1.1" },
      out.res,
    );
    expect(out.status).to.equal(200);
    expect((out.body as { status: string }).status).to.equal("subscribed");
    expect(wrote).to.equal(false);
  });

  it("rate limits by ip_hash key", async () => {
    const keys: string[] = [];
    const handler = createWaitlistHandler({
      getDb: () => null,
      rateLimit: (key) => {
        keys.push(key);
        return false;
      },
      ipHashSalt: "rl-salt",
    });
    const out = mockRes();
    await handler({ method: "POST", body: { email: "x@y.com" }, headers: {}, ip: "8.8.8.8" }, out.res);
    expect(out.status).to.equal(429);
    expect(keys[0]).to.equal(hashWaitlistIp("8.8.8.8", "rl-salt"));
    expect(keys[0]).to.not.equal("8.8.8.8");
  });

  it("requires admin token for export", async () => {
    const handler = createWaitlistExportHandler({
      getDb: () => ({ select: () => ({ from: () => ({ orderBy: async () => [] }) }) }) as never,
      adminToken: "admin-token-16chars",
    });
    const denied = mockRes();
    await handler({ method: "GET", headers: {} }, denied.res);
    expect(denied.status).to.equal(401);

    const allowed = mockRes();
    await handler({ method: "GET", headers: { authorization: "Bearer admin-token-16chars" } }, allowed.res);
    expect(allowed.status).to.equal(200);
    expect(allowed.ended).to.include("email_normalized");
    expect(allowed.headers.get("content-type")).to.match(/text\/csv/);
  });

  it("requires admin token for count", async () => {
    const handler = createWaitlistCountHandler({
      getDb: () =>
        ({
          select: () => ({
            from: async () => [{ value: 3 }],
          }),
        }) as never,
      adminToken: "admin-token-16chars",
    });
    const denied = mockRes();
    await handler({ method: "GET", headers: {} }, denied.res);
    expect(denied.status).to.equal(401);

    const allowed = mockRes();
    await handler({ method: "GET", headers: { "x-admin-token": "admin-token-16chars" } }, allowed.res);
    expect(allowed.status).to.equal(200);
    expect(allowed.body).to.deep.equal({ count: 3 });
  });
});
