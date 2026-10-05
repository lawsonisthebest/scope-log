ALTER TABLE projects ADD COLUMN completed_at timestamptz;
UPDATE projects p SET completed_at = history.completed_at
FROM (
  SELECT project_id, clerk_id, max(created_at) AT TIME ZONE 'UTC' AS completed_at
  FROM activities
  WHERE type = 'project' AND message LIKE 'Project completed: %'
  GROUP BY project_id, clerk_id
) history
WHERE p.id = history.project_id AND p.clerk_id = history.clerk_id AND p.status = 'Complete';
ALTER TABLE time_entries ADD COLUMN intervals jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE timer_sessions ADD COLUMN intervals jsonb NOT NULL DEFAULT '[]'::jsonb;
