import {afterAll,beforeAll,describe,expect,it,vi} from "vitest";
import {randomUUID,createHash} from "node:crypto";
import {and,eq,sql} from "drizzle-orm";
const identity=vi.hoisted(()=>({id:null as string|null}));
vi.mock("server-only",()=>({}));
vi.mock("@clerk/nextjs/server",()=>({auth:async()=>({userId:identity.id}),currentUser:async()=>({fullName:"ScopeLog automated test",primaryEmailAddress:{emailAddress:"test@example.invalid"}})}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {db} from "../../app/lib/db";
import * as tables from "../../app/lib/schema";
import * as actions from "../../app/actions";
import * as workspaceActions from "../../app/workspaces/actions";
import {GET as download} from "../../app/api/evidence/[evidenceId]/download/route";
import {GET as exportData} from "../../app/api/export/route";
import type {ActionResult} from "../../app/lib/validation";

const owner=`scopelog_test_${randomUUID()}`,other=`scopelog_test_${randomUUID()}`;
let workspaceId:string,projectId:string,otherWorkspaceId:string,otherProjectId:string,findingId:string,evidenceId:string,reportId:string,skillId:string;
function data<T>(result:ActionResult<T>):T {if(!result.ok)throw new Error(result.error);return result.data;}
function form(values:Record<string,string>,scoped=true){const f=new FormData();if(scoped){f.set("workspaceId",workspaceId);f.set("projectId",projectId);}for(const [key,value] of Object.entries(values))f.set(key,value);return f;}
const req=new Request("http://localhost/api/test");
beforeAll(async()=>{
  identity.id=owner;workspaceId=data(await workspaceActions.createWorkspace("Automated test workspace")).id;projectId=data(await workspaceActions.createProject(workspaceId,"Automated assessment")).id;
  identity.id=other;otherWorkspaceId=data(await workspaceActions.createWorkspace("Other isolated test workspace")).id;otherProjectId=data(await workspaceActions.createProject(otherWorkspaceId,"Other assessment")).id;identity.id=owner;
});
afterAll(async()=>{
  // Cleanup is strictly limited to the two random test identities generated above.
  for(const clerkId of [owner,other]){
    identity.id=clerkId;
    const rows=await db.select({id:tables.workspaces.id}).from(tables.workspaces).where(eq(tables.workspaces.clerkId,clerkId));
    for(const row of rows) data(await workspaceActions.deleteWorkspace(row.id));
    await db.delete(tables.skills).where(eq(tables.skills.clerkId,clerkId));
  }identity.id=null;
});
describe.sequential("real database workflow and tenant isolation (Clerk session mocked)",()=>{
  it("rejects signed-out actions and private downloads/exports",async()=>{
    identity.id=null;expect((await actions.createFinding(form({title:"Blocked",category:"Vulnerability",severity:"High"}))).ok).toBe(false);expect((await workspaceActions.createWorkspace("Blocked")).ok).toBe(false);expect((await exportData()).status).toBe(401);expect((await download(req,{params:Promise.resolve({evidenceId:randomUUID()})})).status).toBe(401);identity.id=owner;
  });
  it("creates and updates projects with real progress and due dates",async()=>{
    const result=await workspaceActions.updateProject(projectId,{name:"Automated assessment",description:"Authorized test scope",status:"Incomplete",priority:"High",dueDate:"2026-10-01",progress:40});expect(data(result).progress).toBe(40);
    expect(data(await workspaceActions.updateProject(projectId,{name:"Automated assessment",description:"Authorized test scope",status:"Complete",priority:"High",dueDate:"2026-10-01",progress:40})).progress).toBe(100);
  });
  it("rejects malformed inputs and cross-workspace project associations",async()=>{
    expect((await actions.createFinding(form({title:"Bad enum",category:"invalid",severity:"High"}))).ok).toBe(false);
    expect((await actions.createFinding(form({title:"Wrong scope",category:"Vulnerability",severity:"High",workspaceId:otherWorkspaceId}))).ok).toBe(false);
    expect((await workspaceActions.createProject("not-a-uuid","Bad")).ok).toBe(false);
    expect((await actions.logTime(form({minutes:"1.5"}))).ok).toBe(false);
  });
  it("persists findings and status changes",async()=>{
    data(await actions.createFinding(form({title:"Missing authorization",category:"Vulnerability",severity:"High",description:"Fixture impact and remediation."})));
    const [row]=await db.select().from(tables.findings).where(eq(tables.findings.clerkId,owner));findingId=row.id;expect(row.projectId).toBe(projectId);
    data(await actions.updateFindingStatus(findingId,"In review"));data(await actions.editFinding(findingId,form({title:"Validated authorization finding",category:"Security issue",severity:"Critical",status:"Resolved",description:"Resolved fixture."})));
    const [updated]=await db.select().from(tables.findings).where(eq(tables.findings.id,findingId));expect(updated.status).toBe("Resolved");
  });
  it("uploads evidence and returns exact bytes through its protected download route",async()=>{
    const upload=form({name:"Response log",kind:"Log",category:"Supporting evidence",description:"Synthetic test log",sourceUrl:"https://example.com/test"});upload.set("file",new File(["synthetic evidence\n"],"evidence.txt",{type:"text/plain"}));data(await actions.createEvidence(upload));
    const [row]=await db.select().from(tables.evidence).where(eq(tables.evidence.clerkId,owner));evidenceId=row.id;expect(row.sha256).toBe(createHash("sha256").update("synthetic evidence\n").digest("hex"));
    const response=await download(req,{params:Promise.resolve({evidenceId})});expect(response.status).toBe(200);expect(await response.text()).toBe("synthetic evidence\n");expect(response.headers.get("cache-control")).toBe("private, no-store");expect(response.headers.get("content-disposition")).toContain("attachment;");
    const oversized=form({name:"Too large",kind:"Document",category:"Supporting evidence"});oversized.set("file",new File([new Uint8Array(2097153)],"large.bin"));expect((await actions.createEvidence(oversized)).ok).toBe(false);
  });
  it("generates reports from all project records and saves final revisions",async()=>{
    data(await actions.createNote(form({title:"Report source note",content:"Research context must be included"})));
    reportId=data(await actions.createReport(form({name:"Assessment report"}))).id;
    const [row]=await db.select().from(tables.reports).where(eq(tables.reports.id,reportId));expect(row.content).toContain("Validated authorization finding");expect(row.content).toContain("Response log");expect(row.content).toContain("Research context must be included");expect(row.content).toContain("Synthetic test log");expect(row.content).toContain("## Recommendations");
    data(await actions.updateReport(reportId,"Final report","# Reviewed assessment\n\nAll evidence validated.","Final"));expect((await actions.updateReport(reportId,"Empty report","","Final")).ok).toBe(false);
  });
  it("supports research notes, time logs, contacts and skill corrections",async()=>{
    data(await actions.createNote(form({title:"Research note",content:"Synthetic reasoning"})));const [note]=await db.select().from(tables.notes).where(eq(tables.notes.clerkId,owner));data(await actions.editNote(note.id,form({title:"Updated research",content:"Updated reasoning"})));
    data(await actions.logTime(form({minutes:"45",description:"Validation session"})));data(await actions.addTeamMember(projectId,"Test contact","contact@example.invalid","Reviewer"));expect((await actions.addTeamMember(projectId,"Test contact","contact@example.invalid","Reviewer")).ok).toBe(false);
    data(await actions.createSkill(form({name:"Access control testing",category:"Web security",notes:"Test notes"},false)));const [skill]=await db.select().from(tables.skills).where(eq(tables.skills.clerkId,owner));skillId=skill.id;data(await actions.updateSkillProgress(skillId,80));data(await actions.editSkill(skillId,form({name:skill.name,category:skill.category,notes:"Revised goal",progress:"30"},false)));
    const [updated]=await db.select().from(tables.skills).where(eq(tables.skills.id,skillId));expect(updated.progress).toBe(30);
  });
  it("blocks another user from updating, deleting, downloading or exporting owner records",async()=>{
    identity.id=other;
    expect((await actions.updateFindingStatus(findingId,"Open")).ok).toBe(false);expect((await actions.updateReport(reportId,"Stolen","Bad","Final")).ok).toBe(false);expect((await actions.deleteRecord("evidence",evidenceId)).ok).toBe(false);expect((await workspaceActions.renameWorkspace(workspaceId,"Stolen")).ok).toBe(false);expect((await workspaceActions.deleteWorkspace(workspaceId)).ok).toBe(false);
    expect((await download(req,{params:Promise.resolve({evidenceId})})).status).toBe(404);
    const exported=await (await exportData()).json();expect(exported.workspaces.map((w:{id:string})=>w.id)).toEqual([otherWorkspaceId]);expect(exported.findings).toHaveLength(0);expect(exported.evidence).toHaveLength(0);
    identity.id=owner;const exportedOwner=await(await exportData()).json();expect(exportedOwner.evidence[0].fileData).toBe(Buffer.from("synthetic evidence\n").toString("base64"));
  });
  it("enforces ownership relationships in the database itself",async()=>{
    await expect(db.insert(tables.findings).values({clerkId:other,workspaceId:otherWorkspaceId,projectId,title:"Invalid cross-tenant insert"})).rejects.toThrow();
    await expect(db.insert(tables.timeEntries).values({clerkId:owner,workspaceId,projectId,minutes:-1})).rejects.toThrow();
  });
  it("rolls back the entire batch when a later statement fails",async()=>{
    const name=`rollback-${randomUUID()}`;await expect(db.batch([db.insert(tables.skills).values({clerkId:owner,name,category:"Test"}),db.execute(sql`select 1/0`)])).rejects.toThrow();
    const rows=await db.select().from(tables.skills).where(and(eq(tables.skills.clerkId,owner),eq(tables.skills.name,name)));expect(rows).toHaveLength(0);
  });
  it("deletes a project and all dependent records without touching another user's project",async()=>{
    data(await workspaceActions.deleteProject(projectId));
    for(const table of [tables.findings,tables.evidence,tables.reports,tables.notes,tables.timeEntries,tables.teamMembers])expect(await db.select({id:table.id}).from(table).where(eq(table.projectId,projectId))).toHaveLength(0);
    expect(await db.select().from(tables.projects).where(eq(tables.projects.id,otherProjectId))).toHaveLength(1);
  });
  it("deletes a workspace with every child type atomically",async()=>{
    projectId=data(await workspaceActions.createProject(workspaceId,"Cleanup fixture")).id;
    data(await actions.createFinding(form({title:"Cleanup",category:"Vulnerability",severity:"Low"})));data(await actions.createEvidence(form({name:"Cleanup",kind:"Document",category:"Supporting evidence"})));data(await actions.createReport(form({name:"Cleanup report"})));data(await actions.createNote(form({title:"Cleanup note",content:"Cleanup"})));data(await actions.logTime(form({minutes:"10"})));data(await actions.addTeamMember(projectId,"Cleanup contact","cleanup@example.invalid","Reviewer"));
    data(await workspaceActions.deleteWorkspace(workspaceId));
    for(const table of [tables.workspaces,tables.projects,tables.findings,tables.evidence,tables.reports,tables.notes,tables.timeEntries,tables.teamMembers,tables.activities])expect(await db.select({id:table.id}).from(table).where(eq(table.clerkId,owner))).toHaveLength(0);
    expect(await db.select().from(tables.workspaces).where(eq(tables.workspaces.id,otherWorkspaceId))).toHaveLength(1);
  });
});
