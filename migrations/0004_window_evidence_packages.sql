CREATE TABLE IF NOT EXISTS window_evidence_packages (
  cache_key text PRIMARY KEY,
  package_json text NOT NULL,
  built_at timestamptz NOT NULL DEFAULT now()
);
