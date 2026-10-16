# Waitlist backend — implementation plan

## Primary goal

A visit to skyhedge.app that submits the waitlist form stores that email durably in Neon Postgres, and the owner can export the full list as CSV (and see a private count) without any public leak of signup volume.

## Phase 0: Documentation discovery

**How this serves the primary goal:** Confirms we reuse the existing Neon + Drizzle + Vercel serverless path instead of inventing a new store or API shape the form won't accept.

### Findings (sources)

| Source | Finding |
| --- | --- |
| `package.json` | `@neondatabase/serverless`, `drizzle-orm`, `zod` already installed |
| `server/db.ts` | `createDb()` returns null without `DATABASE_URL`; otherwise Neon HTTP + Drizzle |
| `shared/schema.ts` | `waitlistSignups` exists: id, email, email_normalized, source, created_at |
| `migrations/0002_waitlist_signups.sql` | Creates that table + unique on email_normalized |
| `api/waitlist.ts` + `server/services/waitlist.ts` | POST handler: zod, honeypot (`company`), dedupe, in-memory rate limit by raw IP, CORS via `shared/public-origins.ts` |
| `client/src/components/waitlist-form.tsx` | POSTs `{ email, company, source }` to `/api/waitlist`; expects success JSON / ApiError message |
| `.env.example` | `DATABASE_URL` documented; no email provider; no `ADMIN_TOKEN` |
| Grep for RESEND/SENDGRID/POSTMARK | None configured |

### Allowed APIs / patterns to copy

- Neon HTTP: `drizzle(neon(connectionString), { schema })` from `server/db.ts`
- Handler factory: `createWaitlistHandler` in `server/services/waitlist.ts`
- CORS: `applyCorsHeaders` / `isCorsPreflight` + `ALLOWED_WEB_ORIGINS` (skyhedge.app, www, skyhedge.vercel.app)
- Vercel function entry: `api/waitlist.ts` body parse + forward IP
- Tests: mocha + chai under `server/services/*.test.ts` via `npm run test:server`

### Anti-patterns

- Do not add a new DB vendor or paid email account without approval
- Do not store raw IP; hash with a server salt
- Do not expose public `/api/waitlist` counts
- Do not use the word "insurance"
- Do not invent Resend/SendGrid until a key exists

### Durable store decision

**Use existing Neon via `DATABASE_URL`.** No new accounts. If prod lacks `DATABASE_URL`, owner adds the Neon connection string in Vercel (no new product purchase assumed if Neon project already exists for this app).

---

## Phase 1: Schema + migration widen

**How this serves the primary goal:** Persisted rows carry attribution and abuse-control fields so the export is useful and rate limiting does not keep raw IPs.

### What to implement

1. Extend `waitlistSignups` in `shared/schema.ts` with: `referrer`, `utmSource`, `utmMedium`, `utmCampaign`, `ipHash`, `userAgent` (nullable text where appropriate).
2. Commit `migrations/0003_waitlist_attribution.sql` as `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` so existing 0002 deploys stay valid.
3. Keep unique on lowercased email (`email_normalized`).

### Verification

- [ ] Schema fields match migration column names
- [ ] Migration is idempotent (`IF NOT EXISTS`)

### Anti-pattern guards

- No hardcoded connection strings
- Do not drop/recreate the table (would wipe real signups)

---

## Phase 2: POST /api/waitlist hardened

**How this serves the primary goal:** Every real signup lands once, bots and duplicates do not break UX, and CORS matches the live site origins.

### What to implement

1. Zod: email + honeypot + source + optional referrer/utm_* from body (form can send later; API accepts now).
2. Rate limit key = `ip_hash` (sha256 of `IP_HASH_SALT` + IP), not raw IP.
3. Duplicate → `200 { ok: true, status: "already_subscribed" }` (no error leak).
4. Honeypot → fake success, no DB write.
5. Persist new fields; capture `User-Agent` header.
6. Keep JSON errors the form already maps via `ApiError`.

### Verification

- [ ] Unit/handler tests: valid, invalid, duplicate, honeypot, rate limit
- [ ] CORS still allowlists the three origins in `public-origins.ts`

### Anti-pattern guards

- Never return whether email existed beyond the same success shape
- Never log raw IP or full email in responses

---

## Phase 3: Admin export + count

**How this serves the primary goal:** Owner can see and download the list without a public admin UI.

### What to implement

1. `GET /api/waitlist/export` → CSV; `Authorization: Bearer $ADMIN_TOKEN` (or `x-admin-token`).
2. `GET /api/waitlist/count` → `{ count: N }` same auth; no public counts.
3. Shared auth helper; 401/503 clear JSON when misconfigured.

### Verification

- [ ] Export without token → 401
- [ ] Wrong token → 401
- [ ] Correct token → CSV with header row
- [ ] Count without token → 401

### Anti-pattern guards

- Do not put ADMIN_TOKEN in client code or docs as a real value

---

## Phase 4: Env, docs, optional email

**How this serves the primary goal:** Deployable config is explicit so prod actually writes rows.

### Env vars to add in Vercel (Production + Preview as needed)

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string (required for writes) |
| `ADMIN_TOKEN` | Bearer secret for export/count (required for admin GETs) |
| `IP_HASH_SALT` | Secret salt for IP hashing (required for stable rate-limit keys) |

### Confirmation email

**Next step only** — no provider configured. Document as follow-up (e.g. Resend) without creating accounts.

### Docs

Write `docs/waitlist-backend.md`: flow, env vars, how to export CSV, how to run migration.

### Verification

- [ ] `.env.example` lists the three vars (empty values)
- [ ] Docs never contain real secrets

---

## Phase 5: Deploy + prove

**How this serves the primary goal:** A real signup is visible in DB/CSV on production.

### What to implement

1. Commit + push `seeker-revamp` (waitlist files only; leave unrelated map WIP unstaged).
2. Ensure migration applied against Neon (script or one-shot SQL via Neon console — ask before paid tooling).
3. Deploy Vercel prod from that branch.
4. POST a unique test email → confirm in export CSV → **ask before delete**, then delete only that test row.

### Verification

- [ ] Live POST returns 200 subscribed
- [ ] Export CSV contains that email
- [ ] Test row deleted after confirmation
- [ ] `npm run test:server` passes waitlist tests

### Anti-pattern guards

- Stop before creating paid services, pasting secrets into chat, or deleting non-test rows
