# Waitlist backend

How skyhedge.app stores waitlist signups and how you export the list.

## How it works

1. The landing form (`WaitlistForm`) `POST`s JSON to `/api/waitlist` with `email`, honeypot field `company` (always empty for humans), `source`, optional `referrer`, and optional UTM fields from the URL.
2. The Vercel function (`api/waitlist/index.ts`) validates with zod, rejects filled honeypots with a fake success (no DB write), rate-limits by **hashed** IP (`IP_HASH_SALT` + IP → SHA-256), and upserts into Neon Postgres via Drizzle.
3. Duplicate emails return the same success JSON as new signups (`{ ok: true, status: "subscribed" }`) so the UI never errors and the API does not help email enumeration.
4. Rows live in `waitlist_signups` (see `shared/schema.ts` and migrations `0002` / `0003`).

CORS allowlist: `https://skyhedge.app`, `https://www.skyhedge.app`, `https://skyhedge.vercel.app`.

## Table

| Column | Notes |
| --- | --- |
| `id` | UUID |
| `email` | As submitted (trimmed) |
| `email_normalized` | Lowercased; **unique** |
| `source` | Default `landing` |
| `referrer` | Optional document referrer |
| `utm_source` / `utm_medium` / `utm_campaign` | Optional |
| `ip_hash` | SHA-256 hex; never raw IP |
| `user_agent` | Truncated request UA |
| `created_at` | timestamptz |

## Env vars (Vercel → Project → Settings → Environment Variables)

Add for **Production** (and Preview if you test there):

| Variable | Required for | Description |
| --- | --- | --- |
| `DATABASE_URL` | Signups | Neon Postgres connection string |
| `ADMIN_TOKEN` | Export / count | ≥16 char random secret |
| `IP_HASH_SALT` | Rate limit + stored hash | Random salt; changing it resets rate-limit buckets and changes new `ip_hash` values |

Never commit real values. Generate locally, e.g.:

```bash
openssl rand -hex 32
```

## Migrations

Apply against the Neon database pointed at by `DATABASE_URL`:

```bash
# From repo root (SkyHedge-clock-in-redesign), with DATABASE_URL set:
psql "$DATABASE_URL" -f migrations/0002_waitlist_signups.sql
psql "$DATABASE_URL" -f migrations/0003_waitlist_attribution.sql
```

`0003` uses `ADD COLUMN IF NOT EXISTS` and is safe to re-run.

Optional alternative: `npm run db:push` (drizzle-kit) if you prefer schema sync over SQL files — prefer the committed SQL for prod.

## Export the list

```bash
curl -fsSL -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://skyhedge.app/api/waitlist/export" \
  -o waitlist-signups.csv
```

Or header form:

```bash
curl -fsSL -H "x-admin-token: $ADMIN_TOKEN" \
  "https://skyhedge.app/api/waitlist/export" -o waitlist-signups.csv
```

## Private count

```bash
curl -fsSL -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://skyhedge.app/api/waitlist/count"
# → {"count":N}
```

There is **no** public count endpoint.

## Confirmation email

Not wired. No Resend/SendGrid/Postmark keys are in this project. Next step when you want mail: add a provider key, send only after a successful new insert (not on duplicate/honeypot), and keep the signup path succeeding if mail fails.

## Local / Express

`server/routes.ts` mounts the same handlers for `POST /api/waitlist`, `GET /api/waitlist/export`, and `GET /api/waitlist/count` when you run `npm run dev` with `DATABASE_URL` set.

## Tests

```bash
npm run test:server -- --grep waitlist
```

## Vercel Hobby function budget

`/api/waitlist/export` and `/api/waitlist/count` rewrite to `/api/waitlist?action=…` so signup/export/count share one Serverless Function (Hobby limit is 12).
