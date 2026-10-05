import { auth } from "@clerk/nextjs/server";
import { and,eq,ilike } from "drizzle-orm";
import { db } from "@/app/lib/db";
import { evidence,findings,projects,reports,workspaces } from "@/app/lib/schema";
export async function GET(request:Request){
  const {userId}=await auth();if(!userId)return new Response("Unauthorized",{status:401});
  const q=new URL(request.url).searchParams.get("q")?.trim()||"";if(q.length<2||q.length>100)return Response.json([],{headers:{"Cache-Control":"private, no-store"}});
  const pattern=`%${q.replace(/[\\%_]/g,"\\$&")}%`;
  const [ws,ps,fs,es,rs]=await Promise.all([
    db.select({id:workspaces.id,title:workspaces.workspaceName}).from(workspaces).where(and(eq(workspaces.clerkId,userId),ilike(workspaces.workspaceName,pattern))).limit(5),
    db.select({id:projects.id,title:projects.projectName,workspaceId:projects.workspaceId}).from(projects).where(and(eq(projects.clerkId,userId),ilike(projects.projectName,pattern))).limit(8),
    db.select({id:findings.id,title:findings.title,workspaceId:findings.workspaceId,projectId:findings.projectId}).from(findings).where(and(eq(findings.clerkId,userId),ilike(findings.title,pattern))).limit(8),
    db.select({id:evidence.id,title:evidence.name,workspaceId:evidence.workspaceId,projectId:evidence.projectId}).from(evidence).where(and(eq(evidence.clerkId,userId),ilike(evidence.name,pattern))).limit(8),
    db.select({id:reports.id,title:reports.name}).from(reports).where(and(eq(reports.clerkId,userId),ilike(reports.name,pattern))).limit(8),
  ]);
  return Response.json([...ws.map(r=>({...r,type:"Workspace",href:`/workspaces/${r.id}`})),...ps.map(r=>({...r,type:"Project",href:`/workspaces/${r.workspaceId}/projects/${r.id}`})),...fs.map(r=>({...r,type:"Finding",href:r.projectId?`/workspaces/${r.workspaceId}/projects/${r.projectId}?tab=Findings`:`/workspaces/${r.workspaceId}`})),...es.map(r=>({...r,type:"Evidence",href:r.projectId?`/workspaces/${r.workspaceId}/projects/${r.projectId}?tab=Evidence`:`/workspaces/${r.workspaceId}`})),...rs.map(r=>({...r,type:"Report",href:`/reports/${r.id}`}))],{headers:{"Cache-Control":"private, no-store"}});
}
