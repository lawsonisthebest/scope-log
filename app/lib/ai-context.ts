import "server-only";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "./db";
import {
  evidence,
  findings,
  notes,
  projects,
  reports,
  timeEntries,
} from "./schema";
import { automaticEntries, dateInZone, summarizeProgress } from "./progress";
import type { InsightRequest } from "./ai-types";
import { id, ValidationError } from "./validation";

export async function insightContext(request: InsightRequest, userId: string) {
  if (!request || typeof request !== "object")
    throw new ValidationError("Choose an insight to generate.");
  if (request.kind === "project") {
    const projectId = id(request.projectId, "Project");
    const [project] = await db
      .select({
        name: projects.projectName,
        description: projects.description,
        status: projects.status,
        priority: projects.priority,
        progress: projects.progress,
        dueDate: projects.dueDate,
      })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.clerkId, userId)))
      .limit(1);
    if (!project) throw new ValidationError("Project not found.");
    const [issues, artifacts, research] = await Promise.all([
      db
        .select({
          title: findings.title,
          description: findings.description,
          severity: findings.severity,
          status: findings.status,
          category: findings.category,
        })
        .from(findings)
        .where(
          and(eq(findings.projectId, projectId), eq(findings.clerkId, userId)),
        )
        .orderBy(findings.id),
      db
        .select({
          name: evidence.name,
          description: evidence.description,
          kind: evidence.kind,
        })
        .from(evidence)
        .where(
          and(eq(evidence.projectId, projectId), eq(evidence.clerkId, userId)),
        )
        .orderBy(evidence.id),
      db
        .select({ title: notes.title, content: notes.content })
        .from(notes)
        .where(and(eq(notes.projectId, projectId), eq(notes.clerkId, userId)))
        .orderBy(notes.id),
    ]);
    return {
      source: {
        today: new Date().toISOString().slice(0, 10),
        project,
        findings: issues,
        evidence: artifacts,
        notes: research,
      },
      instructions:
        "Summarize the recorded state in summary. In focus, identify the most useful documented gap or unresolved issue, distinguishing positive observations from vulnerabilities. In nextStep, suggest one practical next action using the recorded scope. Do not claim the project was tested or is secure. If records are sparse, suggest what to document first.",
      projectId,
    };
  }
  if (request.kind === "overview") {
    const [rooms, issues, artifacts, drafts] = await Promise.all([
      db
        .select({
          name: projects.projectName,
          status: projects.status,
          priority: projects.priority,
          progress: projects.progress,
          dueDate: projects.dueDate,
        })
        .from(projects)
        .where(eq(projects.clerkId, userId))
        .orderBy(desc(projects.lastUpdated), projects.id),
      db
        .select({
          status: findings.status,
          severity: findings.severity,
          category: findings.category,
        })
        .from(findings)
        .where(eq(findings.clerkId, userId)),
      db
        .select({ total: count() })
        .from(evidence)
        .where(eq(evidence.clerkId, userId)),
      db
        .select({ status: reports.status })
        .from(reports)
        .where(eq(reports.clerkId, userId)),
    ]);
    const unresolved = issues.filter(
      (finding) =>
        finding.status !== "Resolved" &&
        finding.category !== "Positive observation",
    );
    return {
      source: {
        today: new Date().toISOString().slice(0, 10),
        totals: {
          projects: rooms.length,
          completedProjects: rooms.filter((room) => room.status === "Complete")
            .length,
          unresolvedFindings: unresolved.length,
          highOrCritical: unresolved.filter((finding) =>
            ["High", "Critical"].includes(finding.severity),
          ).length,
          evidence: artifacts[0].total,
          draftReports: drafts.filter((report) => report.status === "Draft")
            .length,
        },
        recentProjects: rooms.slice(0, 10),
        recentProjectsLimit: 10,
      },
      instructions:
        "Use summary to describe the supplied portfolio totals, focus to explain one priority supported by those totals or recent project metadata, and nextStep to suggest one manageable next action. Do not infer which project owns a finding: that relationship is not supplied. The recent-project list is a sample, not the whole portfolio.",
    };
  }
  if (request.kind === "progress") {
    if (
      typeof request.month !== "string" ||
      !/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(request.month)
    )
      throw new ValidationError("Choose a valid month.");
    if (typeof request.timeZone !== "string" || request.timeZone.length > 100)
      throw new ValidationError("Choose a valid time zone.");
    try {
      new Intl.DateTimeFormat("en", { timeZone: request.timeZone }).format();
    } catch {
      throw new ValidationError("Choose a valid time zone.");
    }
    const [rooms, savedTime] = await Promise.all([
      db
        .select({
          id: projects.id,
          workspaceId: projects.workspaceId,
          name: projects.projectName,
          status: projects.status,
          completedAt: projects.completedAt,
          completedOn: projects.completedOn,
        })
        .from(projects)
        .where(eq(projects.clerkId, userId))
        .orderBy(projects.id),
      db
        .select({
          id: timeEntries.id,
          projectId: timeEntries.projectId,
          workspaceId: timeEntries.workspaceId,
          createdAt: timeEntries.createdAt,
          durationSeconds: timeEntries.durationSeconds,
          minutes: timeEntries.minutes,
          recordedOn: timeEntries.recordedOn,
          intervals: timeEntries.intervals,
        })
        .from(timeEntries)
        .where(eq(timeEntries.clerkId, userId))
        .orderBy(timeEntries.id),
    ]);
    const now = new Date();
    const entries = automaticEntries(
      {
        rooms: rooms.map((room) => ({
          ...room,
          name: room.name || "Untitled room",
          status: room.status || "Incomplete",
          completedAt: room.completedAt?.toISOString() || null,
        })),
        time: savedTime.map((entry) => ({
          ...entry,
          description: null,
          seconds: entry.durationSeconds ?? entry.minutes * 60,
          createdAt: entry.createdAt.toISOString(),
        })),
        timers: [],
      },
      request.timeZone,
      now.getTime(),
    );
    const previous = new Date(`${request.month}-01T12:00:00Z`);
    previous.setUTCMonth(previous.getUTCMonth() - 1);
    const previousMonth = previous.toISOString().slice(0, 7);
    const summary = (month: string) => {
      const totals = summarizeProgress(
        entries.filter((entry) => entry.date.startsWith(month)),
      );
      return { ...totals, minutes: Math.round(totals.minutes * 10) / 10 };
    };
    return {
      source: {
        today: dateInZone(now.toISOString(), request.timeZone),
        timeZone: request.timeZone,
        selectedMonth: request.month,
        selectedMonthTotals: summary(request.month),
        previousMonth,
        previousMonthTotals: summary(previousMonth),
        overallCompletedRooms: rooms.filter(
          (room) => room.status === "Complete",
        ).length,
        basis:
          "Saved time and dated room completions only. Running and paused timers are excluded. Missing activity is not proof that no learning occurred. The current month can be incomplete.",
      },
      instructions:
        "Write a supportive learning review. In summary describe the selected month's saved activity; in focus make a cautious comparison with the previous month, noting partial months when applicable. In nextStep suggest one achievable study habit. Do not infer competence, skill mastery, or productivity from time alone. Do not confuse selected-month totals with overall completions. No percentage comparisons when the previous value is zero.",
    };
  }
  throw new ValidationError("Choose an insight to generate.");
}
