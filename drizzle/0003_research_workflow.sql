ALTER TABLE "findings" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'Vulnerability' NOT NULL;
ALTER TABLE "evidence" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'Supporting evidence' NOT NULL;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "content" text DEFAULT '' NOT NULL;
