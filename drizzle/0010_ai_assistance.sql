CREATE TABLE ai_cache (
  id text PRIMARY KEY,
  clerk_id text NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  result jsonb,
  expires_at timestamptz NOT NULL
);
CREATE INDEX ai_cache_expiry_idx ON ai_cache(expires_at);
CREATE INDEX ai_cache_user_idx ON ai_cache(clerk_id);
CREATE TABLE ai_usage (
  bucket text PRIMARY KEY,
  requests integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL
);
CREATE INDEX ai_usage_expiry_idx ON ai_usage(expires_at);
