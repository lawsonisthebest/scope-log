import "server-only";
import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "./db";
import { aiCache, aiUsage } from "./schema";
import type { AIResult } from "./ai-types";

export async function claimAI(id: string, userId: string, projectId?: string) {
  // The lease exceeds the provider timeout; only one process can generate a snapshot.
  const [claimed] = await db
    .insert(aiCache)
    .values({
      id,
      clerkId: userId,
      projectId,
      expiresAt: new Date(Date.now() + 90000),
    })
    .onConflictDoUpdate({
      target: aiCache.id,
      set: { result: null, expiresAt: new Date(Date.now() + 90000) },
      setWhere: lte(aiCache.expiresAt, sql`now()`),
    })
    .returning({ id: aiCache.id });
  if (claimed) return { claimed: true as const };
  const [existing] = await db
    .select({ result: aiCache.result })
    .from(aiCache)
    .where(and(eq(aiCache.id, id), eq(aiCache.clerkId, userId)))
    .limit(1);
  return { claimed: false as const, result: existing?.result };
}

export async function saveAI(id: string, userId: string, result: AIResult) {
  await db
    .update(aiCache)
    .set({
      result,
      expiresAt: new Date(Date.now() + (result.ok ? 86400000 : 60000)),
    })
    .where(and(eq(aiCache.id, id), eq(aiCache.clerkId, userId)));
}

export async function reserveBucket(
  bucket: string,
  limit: number,
  expiresAt: Date,
) {
  const [reserved] = await db
    .insert(aiUsage)
    .values({ bucket, requests: 1, expiresAt })
    .onConflictDoUpdate({
      target: aiUsage.bucket,
      set: { requests: sql`${aiUsage.requests} + 1` },
      setWhere: sql`${aiUsage.requests} < ${limit}`,
    })
    .returning({ bucket: aiUsage.bucket });
  return Boolean(reserved);
}

export async function pruneAI() {
  await db.batch([
    db.delete(aiCache).where(lte(aiCache.expiresAt, sql`now()`)),
    db.delete(aiUsage).where(lte(aiUsage.expiresAt, sql`now()`)),
  ]);
}
