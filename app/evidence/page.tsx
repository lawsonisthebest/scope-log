import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "../lib/db";
import { evidence, projects, workspaces } from "../lib/schema";
import { Collection } from "../components/collection";
export default async function EvidencePage() {
  const {userId}=await auth();if(!userId)redirect("/sign-in");
  const rows=await db.select({id:evidence.id,name:evidence.name,description:evidence.description,workspaceId:evidence.workspaceId,projectId:evidence.projectId,kind:evidence.kind,category:evidence.category,sourceUrl:evidence.sourceUrl,fileName:evidence.fileName,createdAt:evidence.createdAt,project:projects.projectName,workspace:workspaces.workspaceName}).from(evidence).leftJoin(projects,eq(evidence.projectId,projects.id)).leftJoin(workspaces,eq(evidence.workspaceId,workspaces.id)).where(eq(evidence.clerkId,userId)).orderBy(desc(evidence.createdAt));
  return <div className="page"><header className="page-header"><p className="eyebrow">Across your workspaces</p><h1>Evidence</h1><p>Your assessment artifacts, source links, and supporting context, with private file downloads.</p></header><Collection kind="evidence" rows={rows.map(e=>({id:e.id,title:e.name,description:e.description||"",workspace:e.workspace||"Workspace",project:e.project||"Unassigned project",href:e.projectId?`/workspaces/${e.workspaceId}/projects/${e.projectId}?tab=Evidence`:`/workspaces/${e.workspaceId}`,category:e.category,status:e.kind,updated:e.createdAt.toISOString(),sourceUrl:e.sourceUrl,fileName:e.fileName}))}/></div>;
}
