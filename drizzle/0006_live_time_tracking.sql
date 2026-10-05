ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS duration_seconds integer;
UPDATE time_entries SET duration_seconds = minutes * 60 WHERE duration_seconds IS NULL;
ALTER TABLE time_entries ADD CONSTRAINT time_entries_duration_seconds_range CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 1 AND 86400) NOT VALID;
CREATE TABLE IF NOT EXISTS timer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  clerk_id text NOT NULL,
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  status text DEFAULT 'running' NOT NULL,
  elapsed_seconds integer DEFAULT 0 NOT NULL,
  started_at timestamp DEFAULT now() NOT NULL,
  description text,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS timer_sessions_owner_project_key ON timer_sessions (clerk_id, project_id);
CREATE INDEX IF NOT EXISTS timer_sessions_owner_idx ON timer_sessions (clerk_id);
ALTER TABLE timer_sessions ADD CONSTRAINT timer_sessions_status_check CHECK (status IN ('running', 'paused')) NOT VALID;
ALTER TABLE timer_sessions ADD CONSTRAINT timer_sessions_elapsed_range CHECK (elapsed_seconds BETWEEN 0 AND 86400) NOT VALID;
ALTER TABLE timer_sessions ADD CONSTRAINT timer_sessions_workspace_owner_fk FOREIGN KEY (workspace_id, clerk_id) REFERENCES workspaces (id, clerk_id) ON DELETE CASCADE NOT VALID;
ALTER TABLE timer_sessions ADD CONSTRAINT timer_sessions_project_scope_fk FOREIGN KEY (project_id, workspace_id, clerk_id) REFERENCES projects (id, workspace_id, clerk_id) ON DELETE CASCADE NOT VALID;
