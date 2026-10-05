"use server";
import { runningInterval } from "./lib/progress";
import { buildReport } from "./lib/report-generation";
import { generateNarrative } from "./lib/report-ai";
import { randomUUID, createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "./lib/db";
import { activities, evidence, findings, notes, projects, reports, skills, timeEntries, timerSessions, teamMembers } from "./lib/schema";
import { requireWorkspace } from "./lib/data";
import { attempt, refreshData, session } from "./lib/action-utils";
import { categories, choice, evidenceKinds, findingStatuses, id, integer, MAX_FILE_BYTES, reportStatuses, severities, sourceUrl, text, ValidationError } from "./lib/validation";

async function scope(form: FormData, clerkId: string) {
  const workspaceId = id(form.get("workspaceId"), "Workspace"), projectId = id(form.get("projectId"), "Project");
  await requireWorkspace(workspaceId, clerkId);
  const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId), eq(projects.clerkId, clerkId))).limit(1);
  if (!project) throw new ValidationError("Project not found.");
  return { workspaceId, projectId, project };
}
function event(clerkId: string, workspaceId: string, projectId: string | null, type: string, message: string) { return db.insert(activities).values({ clerkId, workspaceId, projectId, type, message }); }
function touch(clerkId: string, projectId: string | null) { return db.update(projects).set({ lastUpdated: new Date() }).where(and(eq(projects.id, projectId || "00000000-0000-0000-0000-000000000000"), eq(projects.clerkId, clerkId))); }
function findingValues(form: FormData) { return { title: text(form.get("title"), "Finding title"), category: choice(form.get("category"), categories, "Category"), severity: choice(form.get("severity"), severities, "Severity"), description: text(form.get("description"), "Description", 30000, true) }; }

export async function createFinding(form: FormData) { return attempt(async () => {
  const clerkId = await session(), { workspaceId, projectId } = await scope(form, clerkId), values = findingValues(form);
  await db.batch([db.insert(findings).values({ clerkId, workspaceId, projectId, ...values }), event(clerkId, workspaceId, projectId, "finding", `Finding recorded: ${values.title}`), touch(clerkId, projectId)]);
  refreshData();
}); }
export async function editFinding(recordId: string, form: FormData) { return attempt(async () => {
  const clerkId = await session();
  const [record] = await db.select().from(findings).where(and(eq(findings.id, id(recordId)), eq(findings.clerkId, clerkId))).limit(1);
  if (!record) throw new ValidationError("Finding not found.");
  const values = findingValues(form);
  await db.batch([db.update(findings).set({ ...values, status: choice(form.get("status"), findingStatuses, "Status"), updatedAt: new Date() }).where(and(eq(findings.id, recordId), eq(findings.clerkId, clerkId))), event(clerkId, record.workspaceId, record.projectId, "finding", `Finding updated: ${values.title}`), touch(clerkId, record.projectId)]);
  refreshData();
}); }
export async function updateFindingStatus(recordId: string, status: string) { return attempt(async () => {
  const clerkId = await session();
  const [record] = await db.select().from(findings).where(and(eq(findings.id, id(recordId)), eq(findings.clerkId, clerkId))).limit(1);
  if (!record) throw new ValidationError("Finding not found.");
  await db.batch([db.update(findings).set({ status: choice(status, findingStatuses, "Status"), updatedAt: new Date() }).where(and(eq(findings.id, recordId), eq(findings.clerkId, clerkId))), event(clerkId, record.workspaceId, record.projectId, "finding", `${record.title}: ${status}`), touch(clerkId, record.projectId)]);
  refreshData();
}); }
async function evidenceValues(form: FormData) {
  const kind = choice(form.get("kind"), evidenceKinds, "Artifact type"), url = sourceUrl(form.get("sourceUrl"));
  if (kind === "Link" && !url) throw new ValidationError("Add the source URL for this link.");
  const values = { name: text(form.get("name"), "Evidence name"), kind, category: choice(form.get("category"), ["Supporting evidence", ...categories], "Category"), description: text(form.get("description"), "Context", 30000, true), sourceUrl: url };
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return values;
  if (file.size > MAX_FILE_BYTES) throw new ValidationError("Attachments must be 2 MB or smaller. Use a source link for larger files.");
  const bytes = Buffer.from(await file.arrayBuffer());
  return { ...values, fileName: text(file.name.replace(/[\r\n\\/]/g, "_"), "File name", 255), fileType: file.type || "application/octet-stream", fileSize: bytes.length, fileData: bytes.toString("base64"), sha256: createHash("sha256").update(bytes).digest("hex") };
}
export async function createEvidence(form: FormData) { return attempt(async () => {
  const clerkId = await session(), { workspaceId, projectId } = await scope(form, clerkId), values = await evidenceValues(form);
  await db.batch([db.insert(evidence).values({ clerkId, workspaceId, projectId, ...values }), event(clerkId, workspaceId, projectId, "evidence", `Evidence added: ${values.name}`), touch(clerkId, projectId)]);
  refreshData();
}); }
export async function editEvidence(recordId: string, form: FormData) { return attempt(async () => {
  const clerkId = await session();
  const [record] = await db.select({ workspaceId: evidence.workspaceId, projectId: evidence.projectId }).from(evidence).where(and(eq(evidence.id, id(recordId)), eq(evidence.clerkId, clerkId))).limit(1);
  if (!record) throw new ValidationError("Evidence not found.");
  const values = await evidenceValues(form);
  await db.batch([db.update(evidence).set(values).where(and(eq(evidence.id, recordId), eq(evidence.clerkId, clerkId))), event(clerkId, record.workspaceId, record.projectId, "evidence", `Evidence updated: ${values.name}`), touch(clerkId, record.projectId)]);
  refreshData();
}); }
export async function createReport(form: FormData) { return attempt(async () => {
  const clerkId = await session(), { workspaceId, projectId, project } = await scope(form, clerkId), name = text(form.get("name"), "Report name"), reportId = randomUUID();
  const [rows, artifacts, researchNotes] = await Promise.all([
    db.select().from(findings).where(and(eq(findings.projectId, projectId), eq(findings.clerkId, clerkId))),
    db.select({id:evidence.id,name:evidence.name,description:evidence.description,kind:evidence.kind,category:evidence.category,sourceUrl:evidence.sourceUrl,fileName:evidence.fileName,fileSize:evidence.fileSize,sha256:evidence.sha256}).from(evidence).where(and(eq(evidence.projectId, projectId), eq(evidence.clerkId, clerkId))),
    db.select({id:notes.id,title:notes.title,content:notes.content}).from(notes).where(and(eq(notes.projectId,projectId),eq(notes.clerkId,clerkId))),
  ]);
  const snapshot = {name,project:{projectName:project.projectName,description:project.description,status:project.status},findings:rows.map(({id,title,description,severity,status,category})=>({id,title,description,severity,status,category})),evidence:artifacts,notes:researchNotes};
  const generated=await generateNarrative(snapshot,clerkId,projectId);
  const content=buildReport(snapshot,generated.narrative,new Date(),generated.status);
  await db.batch([db.insert(reports).values({ id: reportId, clerkId, workspaceId, projectId, name, content }), event(clerkId, workspaceId, projectId, "report", `Report drafted: ${name}`), touch(clerkId, projectId)]);
  refreshData(); return { id: reportId };
}); }
export async function updateReport(recordId: string, name: string, content: string, status = "Draft") { return attempt(async () => {
  const clerkId = await session();
  const [record] = await db.select().from(reports).where(and(eq(reports.id, id(recordId)), eq(reports.clerkId, clerkId))).limit(1);
  if (!record) throw new ValidationError("Report not found.");
  const reportName = text(name, "Report name"), reportContent = text(content, "Report content", Math.max(200000,record.content.length), true);
  if (status === "Final" && !reportContent) throw new ValidationError("Add report content before marking it final.");
  await db.batch([db.update(reports).set({ name: reportName, content: reportContent, status: choice(status, reportStatuses, "Status"), updatedAt: new Date() }).where(and(eq(reports.id, recordId), eq(reports.clerkId, clerkId))), event(clerkId, record.workspaceId, record.projectId, "report", `Report saved (${status}): ${reportName}`), touch(clerkId, record.projectId)]);
  refreshData();
}); }
export async function createNote(form: FormData) { return attempt(async () => {
  const clerkId = await session(), { workspaceId, projectId } = await scope(form, clerkId), title = text(form.get("title"), "Note title");
  await db.batch([db.insert(notes).values({ clerkId, workspaceId, projectId, title, content: text(form.get("content"), "Note", 30000) }), event(clerkId, workspaceId, projectId, "note", `Note added: ${title}`), touch(clerkId, projectId)]);
  refreshData();
}); }
export async function editNote(recordId: string, form: FormData) { return attempt(async () => {
  const clerkId = await session();
  const [record] = await db.select().from(notes).where(and(eq(notes.id, id(recordId)), eq(notes.clerkId, clerkId))).limit(1);
  if (!record) throw new ValidationError("Note not found.");
  const title = text(form.get("title"), "Note title");
  await db.batch([db.update(notes).set({ title, content: text(form.get("content"), "Note", 30000), updatedAt: new Date() }).where(and(eq(notes.id, recordId), eq(notes.clerkId, clerkId))), event(clerkId, record.workspaceId, record.projectId, "note", `Note updated: ${title}`), touch(clerkId, record.projectId)]);
  refreshData();
}); }
export async function logTime(form: FormData) { return attempt(async () => {
  const clerkId = await session(), { workspaceId, projectId } = await scope(form, clerkId), minutes = integer(form.get("minutes"), 1, 1440, "Minutes");
  await db.batch([db.insert(timeEntries).values({ clerkId, workspaceId, projectId, minutes, description: text(form.get("description"), "Description", 2000, true) }), event(clerkId, workspaceId, projectId, "time", `Time logged: ${minutes} minutes`), touch(clerkId, projectId)]);
  refreshData();
}); }
function sessionSeconds(record: typeof timerSessions.$inferSelect, now = new Date()) {
  const running = record.status === "running" ? Math.max(0, Math.floor((now.getTime() - record.startedAt.getTime()) / 1000)) : 0;
  return Math.min(86400, record.elapsedSeconds + running);
}
export async function startTimer(workspaceIdValue: string, projectIdValue: string, description: string) { return attempt(async () => {
  const clerkId = await session(), workspaceId = id(workspaceIdValue, "Workspace"), projectId = id(projectIdValue, "Project");
  await requireWorkspace(workspaceId, clerkId);
  const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId), eq(projects.clerkId, clerkId))).limit(1);
  if (!project) throw new ValidationError("Project not found.");
  const [existing] = await db.select().from(timerSessions).where(and(eq(timerSessions.projectId, projectId), eq(timerSessions.clerkId, clerkId))).limit(1);
  if (existing) return serializeTimer(existing);
  const [record] = await db.insert(timerSessions).values({ clerkId, workspaceId, projectId, description: text(description, "Description", 2000, true) }).returning();
  refreshData(); return serializeTimer(record);
}); }
export async function pauseTimer(recordId: string) { return attempt(async () => {
  const clerkId = await session(), now = new Date();
  const [record] = await db.select().from(timerSessions).where(and(eq(timerSessions.id, id(recordId)), eq(timerSessions.clerkId, clerkId))).limit(1);
  if (!record) throw new ValidationError("Timer not found.");
  if (record.status === "paused") return serializeTimer(record);
  const [updated] = await db.update(timerSessions).set({ status: "paused", elapsedSeconds: sessionSeconds(record, now), intervals: [...record.intervals, ...runningInterval(record.startedAt.toISOString(), record.elapsedSeconds, record.status, now.getTime())], updatedAt: now }).where(and(eq(timerSessions.id, record.id), eq(timerSessions.clerkId, clerkId))).returning();
  refreshData(); return serializeTimer(updated);
}); }
export async function resumeTimer(recordId: string) { return attempt(async () => {
  const clerkId = await session(), now = new Date();
  const [record] = await db.select().from(timerSessions).where(and(eq(timerSessions.id, id(recordId)), eq(timerSessions.clerkId, clerkId))).limit(1);
  if (!record) throw new ValidationError("Timer not found.");
  if (record.status === "running") return serializeTimer(record);
  const [updated] = await db.update(timerSessions).set({ status: "running", startedAt: now, updatedAt: now }).where(and(eq(timerSessions.id, record.id), eq(timerSessions.clerkId, clerkId))).returning();
  refreshData(); return serializeTimer(updated);
}); }
export async function stopTimer(recordId: string, description: string) { return attempt(async () => {
  const clerkId = await session(), now = new Date();
  const [record] = await db.select().from(timerSessions).where(and(eq(timerSessions.id, id(recordId)), eq(timerSessions.clerkId, clerkId))).limit(1);
  if (!record) throw new ValidationError("Timer not found.");
  const seconds = Math.max(1, sessionSeconds(record, now)), minutes = Math.max(1, Math.ceil(seconds / 60));
  const detail = text(description || record.description, "Description", 2000, true);
  await db.batch([
    db.insert(timeEntries).values({ id: record.id, clerkId, workspaceId: record.workspaceId, projectId: record.projectId, minutes, durationSeconds: seconds, intervals: [...record.intervals, ...runningInterval(record.startedAt.toISOString(), record.elapsedSeconds, record.status, now.getTime())], description: detail }),
    db.delete(timerSessions).where(and(eq(timerSessions.id, record.id), eq(timerSessions.clerkId, clerkId))),
    event(clerkId, record.workspaceId, record.projectId, "time", `Timer saved: ${formatDuration(seconds)}`),
    touch(clerkId, record.projectId),
  ]);
  refreshData(); return { seconds };
}); }
function serializeTimer(record: typeof timerSessions.$inferSelect) { return { id: record.id, status: record.status, elapsedSeconds: record.elapsedSeconds, startedAt: record.startedAt.toISOString(), description: record.description || "" }; }
function formatDuration(seconds: number) { const hours = Math.floor(seconds / 3600), minutes = Math.floor((seconds % 3600) / 60); return hours ? `${hours}h ${minutes}m` : `${Math.max(1, minutes)}m`; }
export async function addTeamMember(projectId: string, name: string, email: string, role: string) { return attempt(async () => {
  const clerkId = await session();
  const [project] = await db.select().from(projects).where(and(eq(projects.id, id(projectId)), eq(projects.clerkId, clerkId))).limit(1);
  if (!project) throw new ValidationError("Project not found.");
  const memberName = text(name, "Name"), memberEmail = text(email, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(memberEmail)) throw new ValidationError("Enter a valid email address.");
  const [existing] = await db.select({ id: teamMembers.id }).from(teamMembers).where(and(eq(teamMembers.projectId, projectId), eq(teamMembers.clerkId, clerkId), eq(teamMembers.email, memberEmail))).limit(1);
  if (existing) throw new ValidationError("This contact is already listed on the project.");
  await db.batch([db.insert(teamMembers).values({ clerkId, projectId, name: memberName, email: memberEmail, role: text(role, "Role", 80) }), event(clerkId, project.workspaceId, projectId, "member", `Project contact added: ${memberName}`)]);
  refreshData();
}); }
export async function removeTeamMember(recordId: string, projectId: string) { return attempt(async () => {
  const clerkId = await session();
  await db.delete(teamMembers).where(and(eq(teamMembers.id, id(recordId)), eq(teamMembers.projectId, id(projectId)), eq(teamMembers.clerkId, clerkId))); refreshData();
}); }
export async function createSkill(form: FormData) { return attempt(async () => {
  const clerkId = await session();
  await db.insert(skills).values({ clerkId, name: text(form.get("name"), "Skill name"), category: text(form.get("category"), "Category"), notes: text(form.get("notes"), "Notes", 10000, true), progress: 0 }); refreshData();
}); }
export async function updateSkillProgress(recordId: string, progress: number) { return attempt(async () => {
  const clerkId = await session();
  const [record] = await db.update(skills).set({ progress: integer(progress, 0, 100, "Progress"), updatedAt: new Date() }).where(and(eq(skills.id, id(recordId)), eq(skills.clerkId, clerkId))).returning({ id: skills.id });
  if (!record) throw new ValidationError("Skill not found."); refreshData();
}); }
export async function editSkill(recordId: string, form: FormData) { return attempt(async () => {
  const clerkId = await session();
  const [record] = await db.update(skills).set({ name: text(form.get("name"), "Skill name"), category: text(form.get("category"), "Category"), notes: text(form.get("notes"), "Notes", 10000, true), progress: integer(form.get("progress"), 0, 100, "Progress"), updatedAt: new Date() }).where(and(eq(skills.id, id(recordId)), eq(skills.clerkId, clerkId))).returning({ id: skills.id });
  if (!record) throw new ValidationError("Skill not found."); refreshData();
}); }
export async function deleteRecord(kind: "finding" | "evidence" | "report" | "note" | "time" | "skill", recordId: string) { return attempt(async () => {
  const clerkId = await session(); id(recordId);
  if (kind === "skill") { await db.delete(skills).where(and(eq(skills.id, recordId), eq(skills.clerkId, clerkId))); }
  else {
    const table = { finding: findings, evidence, report: reports, note: notes, time: timeEntries }[kind];
    if (!table) throw new ValidationError("Invalid record type.");
    const [record] = await db.select({ workspaceId: table.workspaceId, projectId: table.projectId }).from(table).where(and(eq(table.id, recordId), eq(table.clerkId, clerkId))).limit(1);
    if (!record) throw new ValidationError("Record not found.");
    await db.batch([db.delete(table).where(and(eq(table.id, recordId), eq(table.clerkId, clerkId))), event(clerkId, record.workspaceId, record.projectId, kind, `${kind === "time" ? "Time entry" : kind[0].toUpperCase() + kind.slice(1)} deleted`), touch(clerkId, record.projectId)]);
  } refreshData();
}); }

