import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/app/lib/db";
import { activities, projects, workspaces } from "@/app/lib/schema";
import { isId } from "@/app/lib/validation";
import { WorkspaceOverview } from "./workspace-overview";
export default async function WorkspacePage({ params }: { params: Promise<{ workspaceId:string }> }) {
  const {userId} = await auth(); if (!userId) redirect("/sign-in");
  const {workspaceId} = await params; if (!isId(workspaceId)) notFound();
  const [workspace] = await db.select().from(workspaces).where(and(eq(workspaces.id,workspaceId),eq(workspaces.clerkId,userId))).limit(1); if (!workspace) notFound();
  const [rows, log] = await Promise.all([db.select().from(projects).where(and(eq(projects.workspaceId,workspaceId),eq(projects.clerkId,userId))).orderBy(desc(projects.lastUpdated)), db.select().from(activities).where(and(eq(activities.workspaceId,workspaceId),eq(activities.clerkId,userId))).orderBy(desc(activities.createdAt)).limit(8)]);
  return <WorkspaceOverview workspaceId={workspaceId} workspaceName={workspace.workspaceName || "Untitled workspace"} owner={workspace.owner || "Workspace owner"} initialProjects={rows.map(p=>({ id:p.id, name:p.projectName || "Untitled project", status:p.status || "Incomplete", progress:p.progress, priority:p.priority || "Medium", description:p.description || "", dueDate:p.dueDate?.toISOString().slice(0,10) || "" }))} activities={log.map(a=>({id:a.id,message:a.message,createdAt:a.createdAt.toISOString()}))} />;
}
