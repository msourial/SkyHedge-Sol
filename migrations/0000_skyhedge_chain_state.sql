CREATE TABLE indexed_slots (network text PRIMARY KEY, slot bigint NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE markets (address text PRIMARY KEY, market_id bigint NOT NULL UNIQUE, city text NOT NULL, station_id text NOT NULL, state text NOT NULL, metadata jsonb NOT NULL, finalized_slot bigint NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE liquidity_positions (address text PRIMARY KEY, market_address text NOT NULL, provider text NOT NULL, shares bigint NOT NULL, state jsonb NOT NULL, finalized_slot bigint NOT NULL);
CREATE TABLE protection_positions (address text PRIMARY KEY, market_address text NOT NULL, owner text NOT NULL, protected_amount bigint NOT NULL, premium_paid bigint NOT NULL, state jsonb NOT NULL, finalized_slot bigint NOT NULL);
CREATE TABLE settlement_observations (market_address text PRIMARY KEY, authority text NOT NULL, source_hash text NOT NULL, value_mm_x100 bigint NOT NULL, finalized_slot bigint NOT NULL);
CREATE TABLE chain_events (signature text PRIMARY KEY, slot bigint NOT NULL, event_type text NOT NULL, payload jsonb NOT NULL, finalized_at timestamptz NOT NULL);
CREATE TABLE quote_audits (quote_hash text PRIMARY KEY, market_address text, input jsonb NOT NULL, output jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE advisory_sessions (id text PRIMARY KEY, wallet text, input jsonb NOT NULL, recommendation jsonb NOT NULL, approved_at timestamptz);
