"use server";
import { randomUUID } from "node:crypto";
import { currentUser } from "@clerk/nextjs/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { activities, evidence, findings, notes, projects, reports, teamMembers, timeEntries, workspaces } from "../lib/schema";
import { attempt, refreshData, session } from "../lib/action-utils";
import { requireWorkspace } from "../lib/data";
import { choice, dueDate, id, integer, priorities, text, ValidationError } from "../lib/validation";

function serializeWorkspace(row: typeof workspaces.$inferSelect) { return { id: row.id, name: row.workspaceName || "Untitled workspace", owner: row.owner || "Workspace owner", createdAt: row.createdAt.toISOString() }; }
function serializeProject(row: typeof projects.$inferSelect) { return { id: row.id, name: row.projectName || "Untitled project", status: row.status || "Incomplete", createdAt: row.createdAt.toISOString(), type: row.tag || "Security project", updated: row.lastUpdated.toISOString(), description: row.description || "", dueDate: row.dueDate?.toISOString().slice(0, 10) || "", progress: row.progress }; }
export async function createWorkspace(name = "Untitled workspace") { return attempt(async () => {
  const clerkId = await session(), user = await currentUser();
  const [row] = await db.insert(workspaces).values({ clerkId, workspaceName: text(name, "Workspace name"), owner: user?.fullName || user?.primaryEmailAddress?.emailAddress }).returning(); refreshData(); return serializeWorkspace(row);
}); }
export async function renameWorkspace(recordId: string, name: string) { return attempt(async () => {
  const clerkId = await session();
  const [row] = await db.update(workspaces).set({ workspaceName: text(name, "Workspace name") }).where(and(eq(workspaces.id, id(recordId)), eq(workspaces.clerkId, clerkId))).returning();
  if (!row) throw new ValidationError("Workspace not found."); refreshData(); return serializeWorkspace(row);
}); }
export async function createProject(workspaceId: string, name: string) { return attempt(async () => {
  const clerkId = await session(), workspace = await requireWorkspace(workspaceId, clerkId), projectName = text(name, "Project name"), projectId = randomUUID();
  const [rows] = await db.batch([db.insert(projects).values({ id: projectId, clerkId, workspaceId, owner: workspace.owner, projectName, tag: "Security project", priority: "Medium", status: "Incomplete" }).returning(), db.insert(activities).values({ clerkId, workspaceId, projectId, type: "project", message: `Project created: ${projectName}` })]); refreshData(); return serializeProject(rows[0]);
}); }
export async function updateProject(projectId: string, data: { name: string; description: string; status: string; priority: string; dueDate: string; progress: number }) { return attempt(async () => {
  const clerkId = await session();
  const [project] = await db.select().from(projects).where(and(eq(projects.id, id(projectId)), eq(projects.clerkId, clerkId))).limit(1);
  if (!project) throw new ValidationError("Project not found.");
  const projectName = text(data.name, "Project name"), status = choice(data.status, ["Incomplete", "Complete"], "Status"), progress = integer(data.progress, 0, 100, "Progress");
  const [rows] = await db.batch([db.update(projects).set({ projectName, description: text(data.description, "Description", 10000, true), status, completedOn: status === "Complete" ? sql`CASE WHEN ${projects.status} = 'Complete' THEN ${projects.completedOn} ELSE NULL END` : null, completedAt: status === "Complete" ? sql`CASE WHEN ${projects.status} = 'Complete' THEN ${projects.completedAt} ELSE now() END` : null, priority: choice(data.priority, priorities, "Priority"), dueDate: dueDate(data.dueDate), progress: status === "Complete" ? 100 : progress, lastUpdated: new Date() }).where(and(eq(projects.id, projectId), eq(projects.clerkId, clerkId))).returning(), db.insert(activities).values({ clerkId, workspaceId: project.workspaceId, projectId, type: "project", message: `Project updated: ${projectName}` })]); refreshData(); return serializeProject(rows[0]);
}); }
export async function completeProject(projectId: string) { return attempt(async () => {
  const clerkId = await session();
  const [project] = await db.select().from(projects).where(and(eq(projects.id, id(projectId)), eq(projects.clerkId, clerkId))).limit(1);
  if (!project) throw new ValidationError("Project not found.");
  if (project.status === "Complete" && project.progress === 100) return { id: project.id };
  await db.batch([
    db.update(projects).set({ status: "Complete", progress: 100, completedOn: sql`CASE WHEN ${projects.status} = 'Complete' THEN ${projects.completedOn} ELSE NULL END`, completedAt: sql`CASE WHEN ${projects.status} = 'Complete' THEN ${projects.completedAt} ELSE now() END`, lastUpdated: new Date() }).where(and(eq(projects.id, project.id), eq(projects.clerkId, clerkId))),
    db.insert(activities).values({ clerkId, workspaceId: project.workspaceId, projectId: project.id, type: "project", message: `Project completed: ${project.projectName || "Untitled project"}` }),
  ]);
  refreshData(); return { id: project.id };
}); }
export async function deleteWorkspace(recordId: string) { return attempt(async () => {
  const clerkId = await session(); await requireWorkspace(recordId, clerkId);
  const projectIds = db.select({ id: projects.id }).from(projects).where(and(eq(projects.workspaceId, recordId), eq(projects.clerkId, clerkId)));
  // Neon HTTP batch executes all statements atomically in a single transaction.
  await db.batch([
    db.delete(teamMembers).where(and(inArray(teamMembers.projectId, projectIds), eq(teamMembers.clerkId, clerkId))),
    db.delete(notes).where(and(eq(notes.workspaceId, recordId), eq(notes.clerkId, clerkId))),
    db.delete(timeEntries).where(and(eq(timeEntries.workspaceId, recordId), eq(timeEntries.clerkId, clerkId))),
    db.delete(activities).where(and(eq(activities.workspaceId, recordId), eq(activities.clerkId, clerkId))),
    db.delete(findings).where(and(eq(findings.workspaceId, recordId), eq(findings.clerkId, clerkId))),
    db.delete(evidence).where(and(eq(evidence.workspaceId, recordId), eq(evidence.clerkId, clerkId))),
    db.delete(reports).where(and(eq(reports.workspaceId, recordId), eq(reports.clerkId, clerkId))),
    db.delete(projects).where(and(eq(projects.workspaceId, recordId), eq(projects.clerkId, clerkId))),
    db.delete(workspaces).where(and(eq(workspaces.id, recordId), eq(workspaces.clerkId, clerkId))),
  ]); refreshData(); return { id: recordId };
}); }
export async function deleteProject(projectId: string) { return attempt(async () => {
  const clerkId = await session();
  const [project] = await db.select().from(projects).where(and(eq(projects.id, id(projectId)), eq(projects.clerkId, clerkId))).limit(1);
  if (!project) throw new ValidationError("Project not found.");
  await db.batch([
    db.delete(teamMembers).where(and(eq(teamMembers.projectId, projectId), eq(teamMembers.clerkId, clerkId))),
    db.delete(notes).where(and(eq(notes.projectId, projectId), eq(notes.clerkId, clerkId))),
    db.delete(timeEntries).where(and(eq(timeEntries.projectId, projectId), eq(timeEntries.clerkId, clerkId))),
    db.delete(activities).where(and(eq(activities.projectId, projectId), eq(activities.clerkId, clerkId))),
    db.delete(findings).where(and(eq(findings.projectId, projectId), eq(findings.clerkId, clerkId))),
    db.delete(evidence).where(and(eq(evidence.projectId, projectId), eq(evidence.clerkId, clerkId))),
    db.delete(reports).where(and(eq(reports.projectId, projectId), eq(reports.clerkId, clerkId))),
    db.delete(projects).where(and(eq(projects.id, projectId), eq(projects.clerkId, clerkId))),
    db.insert(activities).values({ clerkId, workspaceId: project.workspaceId, type: "project", message: `Project deleted: ${project.projectName}` }),
  ]); refreshData();
}); }


