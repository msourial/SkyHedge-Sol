import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { asc, count, eq } from "drizzle-orm";
import { waitlistSignups } from "../../shared/schema.js";
import type { Db } from "../db";
import type { ApiRequest, ApiResponse } from "./vercel-api.js";
import { applyCorsHeaders, isCorsPreflight } from "./cors.js";
import { scheduleWaitlistTelegram, type WaitlistSignupNotice } from "./waitlist-telegram.js";

const optionalAttr = z.string().trim().max(512).optional().nullable().transform((v) => (v && v.length > 0 ? v : null));

const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .email()
  .refine((value) => !value.includes(" "), "Email must not contain spaces");

const waitlistBodySchema = z.object({
  email: emailSchema,
  /** Honeypot — bots fill this; humans never see it. */
  company: z.string().max(200).optional().default(""),
  source: z.string().trim().max(64).optional().default("landing"),
  referrer: optionalAttr,
  utmSource: optionalAttr,
  utmMedium: optionalAttr,
  utmCampaign: optionalAttr,
});

export type WaitlistSignupInput = {
  email: string;
  emailNormalized: string;
  source: string;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  ipHash: string | null;
  userAgent: string | null;
};

export type WaitlistResult = {
  ok: true;
  /** `already_subscribed` when the email was already on the list (still HTTP 200). */
  status: "subscribed" | "already_subscribed";
};

function sendJson(res: ApiResponse, status: number, body: unknown) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function headerValue(headers: ApiRequest["headers"] | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0];
  return typeof raw === "string" ? raw : undefined;
}

export function normalizeWaitlistEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Hash client IP with a server salt — never store or rate-limit on the raw IP. */
export function hashWaitlistIp(ip: string, salt = process.env.IP_HASH_SALT ?? ""): string {
  const material = `${salt}:${ip.trim() || "unknown"}`;
  return createHash("sha256").update(material).digest("hex");
}

export function validateWaitlistBody(body: unknown):
  | { ok: true; email: string; emailNormalized: string; source: string; referrer: string | null; utmSource: string | null; utmMedium: string | null; utmCampaign: string | null; honeypot: boolean }
  | { ok: false; error: string; message: string } {
  const parsed = waitlistBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return { ok: false, error: "INVALID_EMAIL", message: "Enter a valid email address." };
  }
  const emailNormalized = normalizeWaitlistEmail(parsed.data.email);
  const honeypot = Boolean(parsed.data.company?.trim());
  return {
    ok: true,
    email: parsed.data.email.trim(),
    emailNormalized,
    source: parsed.data.source || "landing",
    referrer: parsed.data.referrer ?? null,
    utmSource: parsed.data.utmSource ?? null,
    utmMedium: parsed.data.utmMedium ?? null,
    utmCampaign: parsed.data.utmCampaign ?? null,
    honeypot,
  };
}

/** Stable fake id for honeypot responses (no DB write). */
export function honeypotAckId(emailNormalized: string): string {
  return createHash("sha256").update(`waitlist-hp:${emailNormalized}`).digest("hex").slice(0, 32);
}

export async function persistWaitlistSignup(db: Db, input: WaitlistSignupInput): Promise<WaitlistResult> {
  const existing = await db
    .select({ id: waitlistSignups.id })
    .from(waitlistSignups)
    .where(eq(waitlistSignups.emailNormalized, input.emailNormalized))
    .limit(1);
  if (existing[0]) return { ok: true, status: "already_subscribed" };

  try {
    await db.insert(waitlistSignups).values({
      id: randomUUID(),
      email: input.email,
      emailNormalized: input.emailNormalized,
      source: input.source,
      referrer: input.referrer,
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
      ipHash: input.ipHash,
      userAgent: input.userAgent,
    });
    return { ok: true, status: "subscribed" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    // Unique race: treat as already subscribed (still HTTP 200 — no error leak).
    if (/unique|duplicate/i.test(message)) return { ok: true, status: "already_subscribed" };
    throw error;
  }
}

export function extractAdminToken(headers: ApiRequest["headers"] | undefined): string | undefined {
  const bearer = headerValue(headers, "authorization");
  if (bearer?.toLowerCase().startsWith("bearer ")) {
    const token = bearer.slice(7).trim();
    if (token) return token;
  }
  const headerToken = headerValue(headers, "x-admin-token");
  return headerToken?.trim() || undefined;
}

export function isValidAdminToken(provided: string | undefined, expected = process.env.ADMIN_TOKEN): boolean {
  if (!provided || !expected || expected.length < 16) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function waitlistRowsToCsv(
  rows: Array<{
    id: string;
    email: string;
    emailNormalized: string;
    source: string;
    referrer: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    ipHash: string | null;
    userAgent: string | null;
    createdAt: Date | string;
  }>,
): string {
  const header = [
    "id",
    "email",
    "email_normalized",
    "source",
    "referrer",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "ip_hash",
    "user_agent",
    "created_at",
  ];
  const escape = (value: string | null | undefined) => {
    const raw = value ?? "";
    if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
    return raw;
  };
  const lines = [header.join(",")];
  for (const row of rows) {
    const created = row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt);
    lines.push(
      [
        escape(row.id),
        escape(row.email),
        escape(row.emailNormalized),
        escape(row.source),
        escape(row.referrer),
        escape(row.utmSource),
        escape(row.utmMedium),
        escape(row.utmCampaign),
        escape(row.ipHash),
        escape(row.userAgent),
        escape(created),
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export async function listWaitlistSignups(db: Db) {
  return db.select().from(waitlistSignups).orderBy(asc(waitlistSignups.createdAt));
}

export async function countWaitlistSignups(db: Db): Promise<number> {
  const rows = await db.select({ value: count() }).from(waitlistSignups);
  return Number(rows[0]?.value ?? 0);
}

export function createWaitlistHandler(dependencies: {
  getDb: () => Db | null;
  rateLimit?: (key: string) => boolean;
  ipHashSalt?: string;
  /** Defaults to a fire-and-forget Telegram notice. Must not block or throw. */
  notifyNewSignup?: (notice: WaitlistSignupNotice) => void;
}) {
  return async function waitlistHandler(
    req: Pick<ApiRequest, "method" | "body" | "headers"> & { ip?: string },
    res: ApiResponse,
  ) {
    applyCorsHeaders(req, res);
    if (isCorsPreflight(req)) {
      return sendJson(res, 204, {});
    }
    if (req.method && req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED", message: "Use POST." });
    }

    const ip = typeof req.ip === "string" ? req.ip : "unknown";
    const ipHash = hashWaitlistIp(ip, dependencies.ipHashSalt ?? process.env.IP_HASH_SALT ?? "");
    if (dependencies.rateLimit && !dependencies.rateLimit(ipHash)) {
      return sendJson(res, 429, { error: "RATE_LIMITED", message: "Too many requests; try again shortly." });
    }

    const validated = validateWaitlistBody(req.body);
    if (!validated.ok) return sendJson(res, 400, { error: validated.error, message: validated.message });

    // Silent success for honeypot fills — never store.
    if (validated.honeypot) {
      return sendJson(res, 200, { ok: true, status: "subscribed", id: honeypotAckId(validated.emailNormalized) });
    }

    const db = dependencies.getDb();
    if (!db) {
      return sendJson(res, 503, {
        error: "WAITLIST_UNAVAILABLE",
        message: "Waitlist signup is temporarily unavailable. Try again soon.",
      });
    }

    const userAgent = headerValue(req.headers, "user-agent")?.slice(0, 512) ?? null;

    try {
      const result = await persistWaitlistSignup(db, {
        email: validated.email,
        emailNormalized: validated.emailNormalized,
        source: validated.source,
        referrer: validated.referrer,
        utmSource: validated.utmSource,
        utmMedium: validated.utmMedium,
        utmCampaign: validated.utmCampaign,
        ipHash,
        userAgent,
      });
      if (result.status === "subscribed") {
        try {
          const notify = dependencies.notifyNewSignup ?? scheduleWaitlistTelegram;
          notify({
            email: validated.emailNormalized,
            source: validated.source,
            referrer: validated.referrer,
            utmSource: validated.utmSource,
            utmMedium: validated.utmMedium,
            utmCampaign: validated.utmCampaign,
            count: () => countWaitlistSignups(db),
          });
        } catch {
          // The row is saved. A notifier bug must not fail the request.
        }
      }
      return sendJson(res, 200, result);
    } catch {
      return sendJson(res, 503, {
        error: "WAITLIST_UNAVAILABLE",
        message: "Waitlist signup is temporarily unavailable. Try again soon.",
      });
    }
  };
}

export function createWaitlistExportHandler(dependencies: {
  getDb: () => Db | null;
  adminToken?: string;
}) {
  return async function waitlistExportHandler(
    req: Pick<ApiRequest, "method" | "headers">,
    res: ApiResponse,
  ) {
    applyCorsHeaders(req, res);
    if (isCorsPreflight(req)) return sendJson(res, 204, {});
    if (req.method && req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED", message: "Use GET." });
    }

    const expected = dependencies.adminToken ?? process.env.ADMIN_TOKEN;
    if (!expected || expected.length < 16) {
      return sendJson(res, 503, { error: "ADMIN_UNCONFIGURED", message: "Admin export is not configured." });
    }
    if (!isValidAdminToken(extractAdminToken(req.headers), expected)) {
      return sendJson(res, 401, { error: "UNAUTHORIZED", message: "Admin token required." });
    }

    const db = dependencies.getDb();
    if (!db) {
      return sendJson(res, 503, { error: "WAITLIST_UNAVAILABLE", message: "Waitlist storage is unavailable." });
    }

    try {
      const rows = await listWaitlistSignups(db);
      const csv = waitlistRowsToCsv(rows);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Disposition", 'attachment; filename="waitlist-signups.csv"');
      res.statusCode = 200;
      res.end(csv);
      return;
    } catch {
      return sendJson(res, 503, { error: "WAITLIST_UNAVAILABLE", message: "Waitlist export failed." });
    }
  };
}

export function createWaitlistCountHandler(dependencies: {
  getDb: () => Db | null;
  adminToken?: string;
}) {
  return async function waitlistCountHandler(
    req: Pick<ApiRequest, "method" | "headers">,
    res: ApiResponse,
  ) {
    applyCorsHeaders(req, res);
    if (isCorsPreflight(req)) return sendJson(res, 204, {});
    if (req.method && req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED", message: "Use GET." });
    }

    const expected = dependencies.adminToken ?? process.env.ADMIN_TOKEN;
    if (!expected || expected.length < 16) {
      return sendJson(res, 503, { error: "ADMIN_UNCONFIGURED", message: "Admin count is not configured." });
    }
    if (!isValidAdminToken(extractAdminToken(req.headers), expected)) {
      return sendJson(res, 401, { error: "UNAUTHORIZED", message: "Admin token required." });
    }

    const db = dependencies.getDb();
    if (!db) {
      return sendJson(res, 503, { error: "WAITLIST_UNAVAILABLE", message: "Waitlist storage is unavailable." });
    }

    try {
      const total = await countWaitlistSignups(db);
      return sendJson(res, 200, { count: total });
    } catch {
      return sendJson(res, 503, { error: "WAITLIST_UNAVAILABLE", message: "Waitlist count failed." });
    }
  };
}
