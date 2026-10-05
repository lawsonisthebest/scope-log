CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clerk_id" text NOT NULL UNIQUE,
  "full_name" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clerk_id" text NOT NULL,
  "owner" text,
  "workspace_name" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clerk_id" text NOT NULL,
  "workspace_id" text NOT NULL,
  "owner" text,
  "tag" text,
  "priority" text,
  "status" text,
  "project_name" text,
  "last_updated" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "findings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clerk_id" text NOT NULL,
  "workspace_id" uuid NOT NULL,
  "project_id" uuid,
  "title" text NOT NULL,
  "severity" text DEFAULT 'Medium' NOT NULL,
  "status" text DEFAULT 'Open' NOT NULL,
  "description" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clerk_id" text NOT NULL,
  "workspace_id" uuid NOT NULL,
  "project_id" uuid,
  "name" text NOT NULL,
  "kind" text DEFAULT 'Document' NOT NULL,
  "description" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clerk_id" text NOT NULL,
  "workspace_id" uuid NOT NULL,
  "project_id" uuid,
  "name" text NOT NULL,
  "status" text DEFAULT 'Draft' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clerk_id" text NOT NULL,
  "name" text NOT NULL,
  "category" text DEFAULT 'General' NOT NULL,
  "progress" integer DEFAULT 0 NOT NULL,
  "notes" text,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
