import { date, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { TimeInterval } from "./progress";
import type { AIResult } from "./ai-types";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  fullName: text("full_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").notNull(),
  owner: text("owner"),
  workspaceName: text("workspace_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").notNull(),
  workspaceId: uuid("workspace_id").notNull(),
  owner: text("owner"),
  tag: text("tag"),
  priority: text("priority"),
  status: text("status"),
  projectName: text("project_name"),
  description: text("description"),
  dueDate: timestamp("due_date"),
  progress: integer("progress").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedOn: date("completed_on", { mode: "string" }),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teamMembers = pgTable("team_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").notNull(),
  projectId: uuid("project_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("Contributor"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const activities = pgTable("activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").notNull(),
  workspaceId: uuid("workspace_id").notNull(),
  projectId: uuid("project_id"),
  type: text("type").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const findings = pgTable("findings", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").notNull(),
  workspaceId: uuid("workspace_id").notNull(),
  projectId: uuid("project_id"),
  title: text("title").notNull(),
  category: text("category").notNull().default("Vulnerability"),
  severity: text("severity").notNull().default("Medium"),
  status: text("status").notNull().default("Open"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const evidence = pgTable("evidence", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").notNull(),
  workspaceId: uuid("workspace_id").notNull(),
  projectId: uuid("project_id"),
  name: text("name").notNull(),
  category: text("category").notNull().default("Supporting evidence"),
  kind: text("kind").notNull().default("Document"),
  description: text("description"),
  sourceUrl: text("source_url"),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  fileData: text("file_data"),
  sha256: text("sha256"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").notNull(),
  workspaceId: uuid("workspace_id").notNull(),
  projectId: uuid("project_id"),
  name: text("name").notNull(),
  content: text("content").notNull().default(""),
  status: text("status").notNull().default("Draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const skills = pgTable("skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull().default("General"),
  progress: integer("progress").notNull().default(0),
  notes: text("notes"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const progressLogs = pgTable("progress_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").notNull(),
  skillId: uuid("skill_id").references(() => skills.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  loggedOn: date("logged_on", { mode: "string" }).notNull(),
  completed: integer("completed").notNull().default(0),
  minutes: integer("minutes").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notes = pgTable("notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").notNull(),
  workspaceId: uuid("workspace_id").notNull(),
  projectId: uuid("project_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const timeEntries = pgTable("time_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").notNull(),
  workspaceId: uuid("workspace_id").notNull(),
  projectId: uuid("project_id").notNull(),
  minutes: integer("minutes").notNull(),
  durationSeconds: integer("duration_seconds"),
  recordedOn: date("recorded_on", { mode: "string" }),
  intervals: jsonb("intervals").$type<TimeInterval[]>().notNull().default([]),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const timerSessions = pgTable("timer_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").notNull(),
  workspaceId: uuid("workspace_id").notNull(),
  projectId: uuid("project_id").notNull(),
  status: text("status").notNull().default("running"),
  elapsedSeconds: integer("elapsed_seconds").notNull().default(0),
  intervals: jsonb("intervals").$type<TimeInterval[]>().notNull().default([]),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Only generated text is cached, never API keys or source prompts.
export const aiCache = pgTable("ai_cache", {
  id: text("id").primaryKey(),
  clerkId: text("clerk_id").notNull(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  result: jsonb("result").$type<AIResult>(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const aiUsage = pgTable("ai_usage", {
  bucket: text("bucket").primaryKey(),
  requests: integer("requests").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
