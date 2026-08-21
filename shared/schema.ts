import { bigint, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const indexedSlots = pgTable("indexed_slots", { network: text("network").primaryKey(), slot: bigint("slot", { mode: "bigint" }).notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow() });
export const markets = pgTable("markets", { address: text("address").primaryKey(), marketId: bigint("market_id", { mode: "bigint" }).notNull(), city: text("city").notNull(), stationId: text("station_id").notNull(), state: text("state").notNull(), metadata: jsonb("metadata").notNull(), finalizedSlot: bigint("finalized_slot", { mode: "bigint" }).notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow() }, (table) => [uniqueIndex("markets_market_id_unique").on(table.marketId)]);
export const liquidityPositions = pgTable("liquidity_positions", { address: text("address").primaryKey(), marketAddress: text("market_address").notNull(), provider: text("provider").notNull(), shares: bigint("shares", { mode: "bigint" }).notNull(), state: jsonb("state").notNull(), finalizedSlot: bigint("finalized_slot", { mode: "bigint" }).notNull() });
export const protectionPositions = pgTable("protection_positions", { address: text("address").primaryKey(), marketAddress: text("market_address").notNull(), owner: text("owner").notNull(), protectedAmount: bigint("protected_amount", { mode: "bigint" }).notNull(), premiumPaid: bigint("premium_paid", { mode: "bigint" }).notNull(), state: jsonb("state").notNull(), finalizedSlot: bigint("finalized_slot", { mode: "bigint" }).notNull() });
export const settlementObservations = pgTable("settlement_observations", { marketAddress: text("market_address").primaryKey(), authority: text("authority").notNull(), sourceHash: text("source_hash").notNull(), valueMmX100: bigint("value_mm_x100", { mode: "bigint" }).notNull(), finalizedSlot: bigint("finalized_slot", { mode: "bigint" }).notNull() });
export const chainEvents = pgTable("chain_events", { signature: text("signature").primaryKey(), slot: bigint("slot", { mode: "bigint" }).notNull(), eventType: text("event_type").notNull(), payload: jsonb("payload").notNull(), finalizedAt: timestamp("finalized_at", { withTimezone: true }).notNull() });
export const quoteAudits = pgTable("quote_audits", { quoteHash: text("quote_hash").primaryKey(), marketAddress: text("market_address"), input: jsonb("input").notNull(), output: jsonb("output").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow() });
export const advisorySessions = pgTable("advisory_sessions", { id: text("id").primaryKey(), wallet: text("wallet"), input: jsonb("input").notNull(), recommendation: jsonb("recommendation").notNull(), approvedAt: timestamp("approved_at", { withTimezone: true }) });
export const settlementEvidence = pgTable("settlement_evidence", {
  sourceHash: text("source_hash").primaryKey(),
  marketAddress: text("market_address"),
  city: text("city").notNull(),
  windowStart: text("window_start").notNull(),
  windowEnd: text("window_end").notNull(),
  methodologyVersion: text("methodology_version").notNull(),
  verdict: text("verdict").notNull(),
  noaaMm: text("noaa_mm").notNull(),
  wxmMm: text("wxm_mm"),
  deltaMm: text("delta_mm"),
  toleranceMm: text("tolerance_mm"),
  evidence: jsonb("evidence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
