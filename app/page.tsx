import { auth } from "@clerk/nextjs/server";
import { and,count,desc,eq,gte,sql } from "drizzle-orm";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { db } from "./lib/db";
import { activities,evidence,findings,projects,reports,workspaces } from "./lib/schema";
import { Dashboard } from "./components/dashboard";
export default async function Home(){
  const {userId}=await auth();if(!userId)return <Welcome/>;
  const now=new Date(),since=new Date(now);since.setUTCDate(since.getUTCDate()-27);since.setUTCHours(0,0,0,0);
  const day=sql<string>`to_char(${activities.createdAt}, 'YYYY-MM-DD')`;
  const [ws,ps,fs,es,rs,log,daily]=await Promise.all([
    db.select({id:workspaces.id,name:workspaces.workspaceName}).from(workspaces).where(eq(workspaces.clerkId,userId)),
    db.select().from(projects).where(eq(projects.clerkId,userId)).orderBy(desc(projects.lastUpdated)),
    db.select({id:findings.id,title:findings.title,status:findings.status,severity:findings.severity,workspaceId:findings.workspaceId,projectId:findings.projectId}).from(findings).where(eq(findings.clerkId,userId)).orderBy(desc(findings.updatedAt)),
    db.select({value:count()}).from(evidence).where(eq(evidence.clerkId,userId)),
    db.select({status:reports.status}).from(reports).where(eq(reports.clerkId,userId)),
    db.select({id:activities.id,message:activities.message,createdAt:activities.createdAt}).from(activities).where(eq(activities.clerkId,userId)).orderBy(desc(activities.createdAt)).limit(6),
    db.select({day,value:count()}).from(activities).where(and(eq(activities.clerkId,userId),gte(activities.createdAt,since))).groupBy(day),
  ]);
  return <Dashboard data={{projects:ps.map(p=>({id:p.id,name:p.projectName||"Untitled project",workspaceId:p.workspaceId,workspace:ws.find(w=>w.id===p.workspaceId)?.name||"Workspace",progress:p.progress,status:p.status||"Incomplete",dueDate:p.dueDate?.toISOString().slice(0,10)||null})),findings:fs,workspaceCount:ws.length,evidenceCount:es[0].value,reportCount:rs.length,finalReports:rs.filter(r=>r.status==="Final").length,activity:log.map(a=>({...a,createdAt:a.createdAt.toISOString()})),daily,today:now.toISOString().slice(0,10)}}/>;
}
function Welcome(){return <div className="welcome-page"><section className="welcome-hero"><div><p className="eyebrow">Security research, organized</p><h1>Keep the work clear.<br/><span>Ship better reports.</span></h1><p className="welcome-description">ScopeLog brings assessments, evidence, findings, and reports into one focused workspace.</p><div className="hero-actions"><Link href="/sign-up" className="button">Get started<ArrowUpRight size={15}/></Link><Link href="/sign-in" className="button-secondary">Sign in</Link></div></div><div className="welcome-preview"><div className="preview-bar"><span/><span/><span/></div><div className="preview-content"><p>Assessment overview</p><h2>Everything in one place</h2>{["Projects and scope","Evidence and findings","Ready-to-share reports"].map(item=><div key={item}><CheckCircle2 size={16}/><span>{item}</span></div>)}</div></div></section><section className="welcome-principles">{[["01","Plan the work","Create a home for every assessment and keep the scope visible."],["02","Capture the proof","Connect observations, evidence, and findings as your research develops."],["03","Share the result","Turn structured work into a clear, useful report." ]].map(([n,title,detail])=><article key={n}><span>{n}</span><h2>{title}</h2><p>{detail}</p></article>)}</section></div>;}
