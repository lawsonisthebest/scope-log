import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isId } from "@/app/lib/validation";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { ReportEditor } from "@/app/components/report-editor";
import { db } from "@/app/lib/db";
import { projects, reports } from "@/app/lib/schema";

export default async function ReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { userId } = await auth();
  const { reportId } = await params;
  if (!userId) redirect("/sign-in");
  if (!isId(reportId)) notFound();
  const [row] = await db.select({ report: reports, projectName: projects.projectName, workspaceId: projects.workspaceId, projectId: projects.id }).from(reports).leftJoin(projects, eq(reports.projectId, projects.id)).where(and(eq(reports.id, reportId), eq(reports.clerkId, userId))).limit(1);
  if (!row) notFound();
  return <main className="page max-w-4xl"><Link href={row.projectId && row.workspaceId ? `/workspaces/${row.workspaceId}/projects/${row.projectId}` : "/reports"} className="text-xs text-[#8fa0aa] hover:text-white">← Back to project</Link><header className="page-header mt-4"><p className="eyebrow">Assessment report · {row.projectName || "Project"}</p><h1>Assessment report</h1><p>Review your generated assessment, refine the narrative, and export a polished report.</p></header><section className="board mt-6 p-5"><ReportEditor report={{ ...row.report, content: row.report.content || "", updatedAt: row.report.updatedAt.toISOString() }} /></section></main>;
}
