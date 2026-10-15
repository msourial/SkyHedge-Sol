import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { waitlistSignups } from "../../shared/schema";
import type { Db } from "../db";
import type { ApiRequest, ApiResponse } from "./vercel-api.js";
import { applyCorsHeaders, isCorsPreflight } from "./cors.js";

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
});

export type WaitlistResult = {
  ok: true;
  status: "subscribed" | "already_subscribed";
};

function sendJson(res: ApiResponse, status: number, body: unknown) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

export function normalizeWaitlistEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateWaitlistBody(body: unknown):
  | { ok: true; email: string; emailNormalized: string; source: string; honeypot: boolean }
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
    honeypot,
  };
}

/** Stable fake id for honeypot responses (no DB write). */
export function honeypotAckId(emailNormalized: string): string {
  return createHash("sha256").update(`waitlist-hp:${emailNormalized}`).digest("hex").slice(0, 32);
}

export async function persistWaitlistSignup(
  db: Db,
  input: { email: string; emailNormalized: string; source: string },
): Promise<WaitlistResult> {
  const existing = await db.select({ id: waitlistSignups.id }).from(waitlistSignups).where(eq(waitlistSignups.emailNormalized, input.emailNormalized)).limit(1);
  if (existing[0]) return { ok: true, status: "already_subscribed" };

  try {
    await db.insert(waitlistSignups).values({
      id: randomUUID(),
      email: input.email,
      emailNormalized: input.emailNormalized,
      source: input.source,
    });
    return { ok: true, status: "subscribed" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    // Unique race: treat as already subscribed.
    if (/unique|duplicate/i.test(message)) return { ok: true, status: "already_subscribed" };
    throw error;
  }
}

export function createWaitlistHandler(dependencies: {
  getDb: () => Db | null;
  rateLimit?: (key: string) => boolean;
}) {
  return async function waitlistHandler(req: Pick<ApiRequest, "method" | "body" | "headers"> & { ip?: string }, res: ApiResponse) {
    applyCorsHeaders(req, res);
    if (isCorsPreflight(req)) {
      return sendJson(res, 204, {});
    }
    if (req.method && req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED", message: "Use POST." });
    }

    const ip = typeof req.ip === "string" ? req.ip : "unknown";
    if (dependencies.rateLimit && !dependencies.rateLimit(ip)) {
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

    try {
      const result = await persistWaitlistSignup(db, validated);
      return sendJson(res, 200, result);
    } catch {
      return sendJson(res, 503, {
        error: "WAITLIST_UNAVAILABLE",
        message: "Waitlist signup is temporarily unavailable. Try again soon.",
      });
    }
  };
}
