import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "../lib/db";
import { findings, projects, workspaces } from "../lib/schema";
import { Collection } from "../components/collection";
export default async function FindingsPage() {
  const {userId}=await auth();if(!userId)redirect("/sign-in");
  const rows=await db.select({finding:findings,project:projects.projectName,workspace:workspaces.workspaceName}).from(findings).leftJoin(projects,eq(findings.projectId,projects.id)).leftJoin(workspaces,eq(findings.workspaceId,workspaces.id)).where(eq(findings.clerkId,userId)).orderBy(desc(findings.updatedAt));
  return <div className="page"><header className="page-header"><p className="eyebrow">Across your workspaces</p><h1>Findings</h1><p>Review issues and observations, prioritize risk, and follow remediation across your assessments.</p></header><Collection kind="finding" rows={rows.map(({finding:f,project,workspace})=>({id:f.id,title:f.title,description:f.description||"",workspace:workspace||"Workspace",project:project||"Unassigned project",href:f.projectId?`/workspaces/${f.workspaceId}/projects/${f.projectId}?tab=Findings`:`/workspaces/${f.workspaceId}`,category:f.category,status:f.status,severity:f.severity,updated:f.updatedAt.toISOString()}))}/></div>;
}
