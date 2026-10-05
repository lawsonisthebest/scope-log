import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/app/lib/db";
import { activities, evidence, findings, notes, projects, reports, skills, progressLogs, teamMembers, timeEntries, workspaces } from "@/app/lib/schema";
export async function GET() {
  const {userId}=await auth();if(!userId)return new Response("Unauthorized",{status:401});
  const [workspaceRows,projectRows,findingRows,evidenceRows,reportRows,noteRows,timeRows,skillRows,contactRows,activityRows,progressRows]=await Promise.all([
    db.select().from(workspaces).where(eq(workspaces.clerkId,userId)),db.select().from(projects).where(eq(projects.clerkId,userId)),db.select().from(findings).where(eq(findings.clerkId,userId)),db.select().from(evidence).where(eq(evidence.clerkId,userId)),db.select().from(reports).where(eq(reports.clerkId,userId)),db.select().from(notes).where(eq(notes.clerkId,userId)),db.select().from(timeEntries).where(eq(timeEntries.clerkId,userId)),db.select().from(skills).where(eq(skills.clerkId,userId)),db.select().from(teamMembers).where(eq(teamMembers.clerkId,userId)),db.select().from(activities).where(eq(activities.clerkId,userId)),db.select().from(progressLogs).where(eq(progressLogs.clerkId,userId)),
  ]);
  const data={format:"scopelog-export",version:1,exportedAt:new Date().toISOString(),workspaces:workspaceRows,projects:projectRows,findings:findingRows,evidence:evidenceRows,reports:reportRows,notes:noteRows,timeEntries:timeRows,skills:skillRows,contacts:contactRows,activities:activityRows,progressLogs:progressRows};
  return new Response(JSON.stringify(data,null,2),{headers:{"Content-Type":"application/json","Content-Disposition":`attachment; filename="scopelog-${new Date().toISOString().slice(0,10)}.json"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}

