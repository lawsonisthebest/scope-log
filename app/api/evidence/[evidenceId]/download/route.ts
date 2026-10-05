import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/app/lib/db";
import { evidence } from "@/app/lib/schema";
import { isId } from "@/app/lib/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ evidenceId: string }> }) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const { evidenceId } = await params;
  if (!isId(evidenceId)) return new Response("Not found", { status: 404 });
  const [record] = await db.select({ fileName: evidence.fileName, fileData: evidence.fileData }).from(evidence).where(and(eq(evidence.id, evidenceId), eq(evidence.clerkId, userId))).limit(1);
  if (!record?.fileData || !record.fileName) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(record.fileData, "base64"), { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(record.fileName).replace(/'/g, "%27")}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox" } });
}
