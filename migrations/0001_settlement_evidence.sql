CREATE TABLE "settlement_evidence" (
	"source_hash" text PRIMARY KEY NOT NULL,
	"market_address" text,
	"city" text NOT NULL,
	"window_start" text NOT NULL,
	"window_end" text NOT NULL,
	"methodology_version" text NOT NULL,
	"verdict" text NOT NULL,
	"noaa_mm" text NOT NULL,
	"wxm_mm" text,
	"delta_mm" text,
	"tolerance_mm" text,
	"evidence" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
