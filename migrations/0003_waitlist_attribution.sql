-- Attribution + abuse-control columns for marketing waitlist (idempotent).
ALTER TABLE "waitlist_signups" ADD COLUMN IF NOT EXISTS "referrer" text;
ALTER TABLE "waitlist_signups" ADD COLUMN IF NOT EXISTS "utm_source" text;
ALTER TABLE "waitlist_signups" ADD COLUMN IF NOT EXISTS "utm_medium" text;
ALTER TABLE "waitlist_signups" ADD COLUMN IF NOT EXISTS "utm_campaign" text;
ALTER TABLE "waitlist_signups" ADD COLUMN IF NOT EXISTS "ip_hash" text;
ALTER TABLE "waitlist_signups" ADD COLUMN IF NOT EXISTS "user_agent" text;
