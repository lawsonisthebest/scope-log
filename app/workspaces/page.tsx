import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "../lib/db";
import { findings, projects, workspaces } from "../lib/schema";
import { WorkspaceManager } from "./workspace-manager";
export default async function WorkspacesPage() {
  const { userId } = await auth(); if (!userId) redirect("/sign-in");
  const [rows, projectRows, findingRows] = await Promise.all([db.select().from(workspaces).where(eq(workspaces.clerkId,userId)).orderBy(desc(workspaces.createdAt)), db.select({ workspaceId: projects.workspaceId, progress: projects.progress }).from(projects).where(eq(projects.clerkId,userId)), db.select({ workspaceId: findings.workspaceId, status: findings.status }).from(findings).where(eq(findings.clerkId,userId))]);
  return <WorkspaceManager initialWorkspaces={rows.map(w => { const children = projectRows.filter(p => p.workspaceId === w.id); return { id:w.id, name:w.workspaceName || "Untitled workspace", owner:w.owner || "Workspace owner", createdAt:w.createdAt.toISOString(), projectCount:children.length, activeFindings:findingRows.filter(f => f.workspaceId === w.id && f.status !== "Resolved").length, progress:children.length ? Math.round(children.reduce((s,p) => s+p.progress,0)/children.length) : 0 }; })} />;
}
