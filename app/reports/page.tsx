import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "../lib/db";
import { reports, projects, workspaces } from "../lib/schema";
import { Collection } from "../components/collection";
export default async function ReportsPage() {
  const {userId}=await auth();if(!userId)redirect("/sign-in");
  const rows=await db.select({id:reports.id,name:reports.name,status:reports.status,updatedAt:reports.updatedAt,project:projects.projectName,workspace:workspaces.workspaceName}).from(reports).leftJoin(projects,eq(reports.projectId,projects.id)).leftJoin(workspaces,eq(reports.workspaceId,workspaces.id)).where(eq(reports.clerkId,userId)).orderBy(desc(reports.updatedAt));
  return <div className="page"><header className="page-header"><p className="eyebrow">Across your workspaces</p><h1>Reports</h1><p>Turn your research into a clear narrative. Draft, review, finalize, and export your assessments.</p></header><Collection kind="report" rows={rows.map(r=>({id:r.id,title:r.name,description:"",workspace:r.workspace||"Workspace",project:r.project||"Unassigned project",href:`/reports/${r.id}`,category:"Assessment report",status:r.status,updated:r.updatedAt.toISOString()}))}/></div>;
}
