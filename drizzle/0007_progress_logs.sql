CREATE TABLE progress_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id text NOT NULL,
  skill_id uuid REFERENCES skills(id) ON DELETE SET NULL,
  title text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('Practice', 'Course', 'Lab', 'Reading', 'Project', 'Other')),
  logged_on date NOT NULL,
  completed integer NOT NULL DEFAULT 0 CHECK (completed BETWEEN 0 AND 10000),
  minutes integer NOT NULL DEFAULT 0 CHECK (minutes BETWEEN 0 AND 1440),
  notes text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX progress_logs_owner_date_idx ON progress_logs (clerk_id, logged_on);
