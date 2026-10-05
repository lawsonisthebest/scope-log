ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "due_date" timestamp;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "progress" integer DEFAULT 0 NOT NULL;
CREATE TABLE IF NOT EXISTS "team_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clerk_id" text NOT NULL,
  "project_id" uuid NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "role" text DEFAULT 'Contributor' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "activities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clerk_id" text NOT NULL,
  "workspace_id" uuid NOT NULL,
  "project_id" uuid,
  "type" text NOT NULL,
  "message" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
