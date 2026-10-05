import { auth } from "@clerk/nextjs/server";
import { and, count, desc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { isId } from "@/app/lib/validation";
import { ProjectPage } from "./project-page";
import { db } from "@/app/lib/db";
import {
  activities,
  evidence,
  findings,
  notes,
  projects,
  reports,
  teamMembers,
  timeEntries,
  timerSessions,
  workspaces,
} from "@/app/lib/schema";

export default async function ProjectRoute({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
  searchParams: Promise<{ activityPage?: string }>;
}) {
  const { userId } = await auth();
  const { workspaceId, projectId } = await params;
  if (!userId) redirect("/sign-in");
  if (!isId(workspaceId) || !isId(projectId)) notFound();
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.clerkId, userId)))
    .limit(1);
  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId),
        eq(projects.clerkId, userId),
      ),
    )
    .limit(1);
  if (!workspace || !project) notFound();
  const [{ total }] = await db
    .select({ total: count() })
    .from(activities)
    .where(
      and(eq(activities.projectId, projectId), eq(activities.clerkId, userId)),
    );
  const requestedPage = Number((await searchParams).activityPage || 1);
  const activityPages = Math.max(1, Math.ceil(total / 5));
  const activityPage = Math.min(
    activityPages,
    Number.isSafeInteger(requestedPage) ? Math.max(1, requestedPage) : 1,
  );
  const [
    findingRows,
    evidenceRows,
    reportRows,
    memberRows,
    noteRows,
    timeRows,
    timerRows,
    activityRows,
  ] = await Promise.all([
    db
      .select()
      .from(findings)
      .where(
        and(eq(findings.projectId, projectId), eq(findings.clerkId, userId)),
      )
      .orderBy(desc(findings.updatedAt)),
    db
      .select({
        id: evidence.id,
        name: evidence.name,
        category: evidence.category,
        kind: evidence.kind,
        description: evidence.description,
        sourceUrl: evidence.sourceUrl,
        fileName: evidence.fileName,
        fileSize: evidence.fileSize,
        sha256: evidence.sha256,
        createdAt: evidence.createdAt,
      })
      .from(evidence)
      .where(
        and(eq(evidence.projectId, projectId), eq(evidence.clerkId, userId)),
      )
      .orderBy(desc(evidence.createdAt)),
    db
      .select()
      .from(reports)
      .where(and(eq(reports.projectId, projectId), eq(reports.clerkId, userId)))
      .orderBy(desc(reports.updatedAt)),
    db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.projectId, projectId),
          eq(teamMembers.clerkId, userId),
        ),
      )
      .orderBy(desc(teamMembers.createdAt)),
    db
      .select()
      .from(notes)
      .where(and(eq(notes.projectId, projectId), eq(notes.clerkId, userId)))
      .orderBy(desc(notes.createdAt)),
    db
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.projectId, projectId),
          eq(timeEntries.clerkId, userId),
        ),
      )
      .orderBy(desc(timeEntries.createdAt)),
    db
      .select()
      .from(timerSessions)
      .where(
        and(
          eq(timerSessions.projectId, projectId),
          eq(timerSessions.clerkId, userId),
        ),
      )
      .limit(1),
    db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.projectId, projectId),
          eq(activities.clerkId, userId),
        ),
      )
      .orderBy(desc(activities.createdAt), desc(activities.id))
      .limit(5)
      .offset((activityPage - 1) * 5),
  ]);
  return (
    <ProjectPage
      workspaceId={workspaceId}
      workspaceName={workspace.workspaceName || "Workspace"}
      activityPage={activityPage}
      activityPages={activityPages}
      project={serializeProject(project)}
      findings={findingRows}
      evidence={evidenceRows.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      }))}
      reports={reportRows.map((item) => ({
        ...item,
        updatedAt: item.updatedAt.toISOString(),
      }))}
      members={memberRows}
      notes={noteRows.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      }))}
      timeEntries={timeRows.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      }))}
      timerSession={
        timerRows[0]
          ? {
              id: timerRows[0].id,
              status: timerRows[0].status,
              elapsedSeconds: timerRows[0].elapsedSeconds,
              startedAt: timerRows[0].startedAt.toISOString(),
              description: timerRows[0].description || "",
            }
          : null
      }
      activities={activityRows.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      }))}
    />
  );
}

function serializeProject(project: typeof projects.$inferSelect) {
  return {
    id: project.id,
    name: project.projectName || "Untitled project",
    description: project.description || "",
    status: project.status || "Planning",
    priority: project.priority || "Medium",
    progress: project.progress,
    dueDate: project.dueDate?.toISOString().slice(0, 10) || "",
    workspaceName: "",
    updated: project.lastUpdated.toISOString(),
  };
}
