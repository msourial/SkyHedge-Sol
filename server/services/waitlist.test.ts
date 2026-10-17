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
import {
  deliverWaitlistTelegram,
  formatWaitlistNotifySource,
  maskWaitlistEmail,
  scheduleWaitlistTelegram,
  type WaitlistSignupNotice,
} from "./waitlist-telegram";
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

  it("returns already_subscribed for duplicates without leaking an error", async () => {
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
    expect(out.body).to.deep.equal({ ok: true, status: "already_subscribed" });
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

  it("notifies only for a new signup and does not wait on it", async () => {
    let calls = 0;
    let finished = false;
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
            values: async () => {},
          }),
        }) as never,
      notifyNewSignup: () => {
        calls += 1;
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            finished = true;
            resolve();
          }, 40);
        });
      },
    });
    const out = mockRes();
    await handler(
      {
        method: "POST",
        body: { email: "jane@gmail.com", utmSource: "twitter", referrer: "https://x.com/skyhedge" },
        headers: {},
        ip: "1.1.1.1",
      },
      out.res,
    );
    expect(out.status).to.equal(200);
    expect(out.body).to.deep.equal({ ok: true, status: "subscribed" });
    expect(calls).to.equal(1);
    expect(finished).to.equal(false);
  });

  it("does not notify duplicates or honeypots", async () => {
    let calls = 0;
    const duplicate = createWaitlistHandler({
      getDb: () =>
        ({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [{ id: "existing" }],
              }),
            }),
          }),
        }) as never,
      notifyNewSignup: () => {
        calls += 1;
      },
    });
    const dupOut = mockRes();
    await duplicate({ method: "POST", body: { email: "dup@example.com" }, headers: {}, ip: "1.1.1.1" }, dupOut.res);
    expect(dupOut.body).to.deep.equal({ ok: true, status: "already_subscribed" });

    const honeypot = createWaitlistHandler({
      getDb: () =>
        ({
          insert: () => ({
            values: async () => {
              throw new Error("should not insert");
            },
          }),
        }) as never,
      notifyNewSignup: () => {
        calls += 1;
      },
    });
    const hpOut = mockRes();
    await honeypot(
      { method: "POST", body: { email: "bot@example.com", company: "Spam Co" }, headers: {}, ip: "1.1.1.1" },
      hpOut.res,
    );
    expect(calls).to.equal(0);
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

function notice(overrides: Partial<WaitlistSignupNotice> = {}): WaitlistSignupNotice {
  return {
    email: "jane@gmail.com",
    source: "landing",
    referrer: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    count: async () => 4,
    ...overrides,
  };
}

describe("waitlist telegram", () => {
  const previousToken = process.env.TELEGRAM_BOT_TOKEN;
  const previousChat = process.env.TELEGRAM_CHAT_ID;

  afterEach(() => {
    if (previousToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previousToken;
    if (previousChat === undefined) delete process.env.TELEGRAM_CHAT_ID;
    else process.env.TELEGRAM_CHAT_ID = previousChat;
  });

  it("masks the local part and keeps the domain", () => {
    expect(maskWaitlistEmail("Jane.Doe@Gmail.com")).to.equal("j***@gmail.com");
    expect(maskWaitlistEmail("a@b.co")).to.equal("a***@b.co");
  });

  it("formats utm, then referrer, then source", () => {
    expect(
      formatWaitlistNotifySource(
        notice({ utmSource: "twitter", utmMedium: "social", utmCampaign: "seeker", referrer: "https://x.com/skyhedge" }),
      ),
    ).to.equal("twitter/social/seeker / https://x.com/skyhedge");
    expect(formatWaitlistNotifySource(notice({ referrer: "https://x.com/skyhedge" }))).to.equal("https://x.com/skyhedge");
    expect(formatWaitlistNotifySource(notice())).to.equal("landing");
  });

  it("skips silently when env vars are missing", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    let counted = false;
    let fetched = false;
    await deliverWaitlistTelegram(
      notice({
        count: async () => {
          counted = true;
          return 1;
        },
      }),
      {
        fetchImpl: async () => {
          fetched = true;
          return new Response(null, { status: 200 });
        },
      },
    );
    expect(counted).to.equal(false);
    expect(fetched).to.equal(false);
  });

  it("sends a masked notice and ignores Telegram failures", async () => {
    const bodies: string[] = [];
    await deliverWaitlistTelegram(notice({ utmSource: "twitter" }), {
      token: "123456:TEST",
      chatId: "99",
      fetchImpl: async (_url, init) => {
        bodies.push(String(init?.body));
        return new Response(JSON.stringify({ ok: true, result: { message_id: 7 } }), { status: 200 });
      },
    });
    expect(bodies).to.have.length(1);
    expect(bodies[0]).to.include("New SkyHedge waitlist signup: j***@gmail.com, total: 4, source: twitter");
    expect(bodies[0]).to.not.include("jane@gmail.com");

    await deliverWaitlistTelegram(notice(), {
      token: "123456:TEST",
      chatId: "99",
      fetchImpl: async () => {
        throw new Error("telegram down");
      },
    });
  });

  it("aborts Telegram after the timeout", async () => {
    const started = Date.now();
    await deliverWaitlistTelegram(notice(), {
      token: "123456:TEST",
      chatId: "99",
      timeoutMs: 40,
      fetchImpl: (_url, init) =>
        new Promise((_resolve, reject) => {
          const abort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          if (init?.signal?.aborted) abort();
          else init?.signal?.addEventListener("abort", abort, { once: true });
        }),
    });
    expect(Date.now() - started).to.be.lessThan(1000);
  });

  it("schedules delivery without waiting for the count", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123456:TEST";
    process.env.TELEGRAM_CHAT_ID = "99";
    let release: (value: number) => void = () => {};
    const gate = new Promise<number>((resolve) => {
      release = resolve;
    });
    let fetched = false;
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 });
    }) as typeof fetch;
    try {
      const started = Date.now();
      scheduleWaitlistTelegram(notice({ count: () => gate }));
      expect(Date.now() - started).to.be.lessThan(50);
      expect(fetched).to.equal(false);
      release(8);
      await gate;
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(fetched).to.equal(true);
    } finally {
      globalThis.fetch = original;
    }
  });
});
