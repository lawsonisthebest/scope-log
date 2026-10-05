import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { eq, like } from "drizzle-orm";
const identity = vi.hoisted(() => ({ id: null as string | null }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: identity.id }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../../app/lib/openrouter", async (original) => ({
  ...(await original<typeof import("../../app/lib/openrouter")>()),
  requestOpenRouter: vi.fn(),
}));
import { db } from "../../app/lib/db";
import {
  aiCache,
  aiUsage,
  findings,
  notes,
  projects,
  timeEntries,
  workspaces,
} from "../../app/lib/schema";
import { generateInsight } from "../../app/ai-actions";
import { generateNarrative } from "../../app/lib/report-ai";
import { buildReport } from "../../app/lib/report-generation";
import { insightContext } from "../../app/lib/ai-context";
import { reserveBucket } from "../../app/lib/ai-store";
import { requestOpenRouter } from "../../app/lib/openrouter";

const owner = `ai_test_${randomUUID()}`,
  other = `ai_test_${randomUUID()}`;
const key = `test-key-${randomUUID()}`;
const account = createHash("sha256").update(key).digest("hex").slice(0, 24);
const workspaceId = randomUUID(),
  otherWorkspaceId = randomUUID(),
  projectId = randomUUID(),
  privateProjectId = randomUUID();
const source = {
  name: "Synthetic report",
  project: {
    projectName: "Synthetic project",
    description: "Fixture scope",
    status: "Incomplete",
  },
  findings: [],
  evidence: [],
  notes: [],
};

beforeAll(async () => {
  vi.stubEnv("OPENROUTER_API_KEY", key);
  vi.stubEnv("OPENROUTER_MODEL", "openrouter/free");
  vi.stubEnv("OPENROUTER_DAILY_LIMIT", "50");
  vi.stubEnv("AI_USER_DAILY_LIMIT", "20");
  identity.id = owner;
  vi.mocked(requestOpenRouter).mockImplementation(async ({ fields }) => ({
    ok: true,
    value: Object.fromEntries(
      fields.map((field) => [field, `Synthetic ${field}`]),
    ),
    model: "fixture:free",
    generatedAt: new Date().toISOString(),
  }));
  await db.insert(workspaces).values([
    { id: workspaceId, clerkId: owner, workspaceName: "AI test" },
    { id: otherWorkspaceId, clerkId: other, workspaceName: "Other AI test" },
  ]);
  await db.insert(projects).values([
    {
      id: projectId,
      clerkId: owner,
      workspaceId,
      projectName: "Synthetic project",
      status: "Complete",
      completedOn: "2026-09-15",
    },
    {
      id: privateProjectId,
      clerkId: other,
      workspaceId: otherWorkspaceId,
      projectName: "Private project",
    },
  ]);
  await db
    .insert(notes)
    .values({
      clerkId: other,
      workspaceId: otherWorkspaceId,
      projectId: privateProjectId,
      title: "Private",
      content: "DO_NOT_SHARE_OTHER_USERS_TEXT",
    });
  await db
    .insert(timeEntries)
    .values({
      clerkId: owner,
      workspaceId,
      projectId,
      minutes: 30,
      durationSeconds: 1800,
      recordedOn: "2026-09-15",
    });
});

afterAll(async () => {
  // Cleanup is limited to this run's random fixture identities and key fingerprint.
  for (const userId of [owner, other]) {
    await db.delete(aiCache).where(eq(aiCache.clerkId, userId));
    await db.delete(notes).where(eq(notes.clerkId, userId));
    await db.delete(timeEntries).where(eq(timeEntries.clerkId, userId));
    await db.delete(findings).where(eq(findings.clerkId, userId));
    await db.delete(projects).where(eq(projects.clerkId, userId));
  }
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  await db.delete(workspaces).where(eq(workspaces.id, otherWorkspaceId));
  await db.delete(aiUsage).where(like(aiUsage.bucket, `${account}:%`));
  vi.unstubAllEnvs();
  identity.id = null;
});

describe.sequential("AI authorization, persisted cache and quota", () => {
  it("rejects signed-out users, cross-user projects and malformed requests before generation", async () => {
    identity.id = null;
    expect(await generateInsight({ kind: "overview" })).toMatchObject({
      ok: false,
    });
    identity.id = owner;
    expect(
      await generateInsight({ kind: "project", projectId: privateProjectId }),
    ).toMatchObject({ ok: false, message: "Project not found." });
    expect(
      await generateInsight({
        kind: "progress",
        month: "2026-99",
        timeZone: "UTC",
      }),
    ).toMatchObject({ ok: false });
    expect(
      await generateInsight({
        kind: "progress",
        month: "2026-09",
        timeZone: "invalid/zone",
      }),
    ).toMatchObject({ ok: false });
    expect(requestOpenRouter).not.toHaveBeenCalled();
  });
  it("builds selected-month progress from saved records and manual dates", async () => {
    const context = await insightContext(
      { kind: "progress", month: "2026-09", timeZone: "America/Denver" },
      owner,
    );
    expect(context.source).toMatchObject({
      selectedMonth: "2026-09",
      selectedMonthTotals: { completed: 1, minutes: 30 },
      previousMonth: "2026-08",
      previousMonthTotals: { completed: 0, minutes: 0 },
    });
    expect(JSON.stringify(context.source)).not.toContain("DO_NOT_SHARE");
  });
  it("coalesces concurrent identical generations and reuses results", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        generateInsight({ kind: "project", projectId }),
      ),
    );
    expect(results.some((result) => result.ok)).toBe(true);
    expect(requestOpenRouter).toHaveBeenCalledTimes(1);
    expect(await generateInsight({ kind: "project", projectId })).toMatchObject(
      { ok: true, cached: true },
    );
    expect(requestOpenRouter).toHaveBeenCalledTimes(1);
    expect(
      JSON.stringify(vi.mocked(requestOpenRouter).mock.calls),
    ).not.toContain("DO_NOT_SHARE");
  });
  it("generates a new insight after source records change", async () => {
    await db
      .insert(findings)
      .values({
        clerkId: owner,
        workspaceId,
        projectId,
        title: "Synthetic gap",
        severity: "High",
      });
    expect(await generateInsight({ kind: "project", projectId })).toMatchObject(
      { ok: true },
    );
    expect(requestOpenRouter).toHaveBeenCalledTimes(2);
  });
  it("identifies hosted report generation accurately and preserves source records on provider failure", async () => {
    const result = await generateNarrative(source, owner, projectId);
    const report = buildReport(
      source,
      result.narrative,
      new Date(),
      result.status,
    );
    expect(report).toContain("generated with OpenRouter");
    expect(report).not.toContain("generated locally");
    vi.mocked(requestOpenRouter).mockResolvedValueOnce({
      ok: false,
      code: "quota",
      message: "Free quota reached.",
    });
    const changed = {
      ...source,
      notes: [
        {
          id: randomUUID(),
          title: "Full source",
          content: "Retain this source text",
        },
      ],
    };
    const failed = await generateNarrative(changed, owner, projectId);
    expect(failed.narrative).toBeUndefined();
    expect(
      buildReport(changed, failed.narrative, new Date(), failed.status),
    ).toContain("Retain this source text");
  });
  it("enforces a database quota atomically under concurrent requests", async () => {
    const bucket = `${account}:concurrency`;
    const reservations = await Promise.all(
      Array.from({ length: 8 }, () =>
        reserveBucket(bucket, 3, new Date(Date.now() + 60000)),
      ),
    );
    expect(reservations.filter(Boolean)).toHaveLength(3);
  });
  it("deletes project snapshots when their project is deleted", async () => {
    await db.delete(findings).where(eq(findings.projectId, projectId));
    await db.delete(timeEntries).where(eq(timeEntries.projectId, projectId));
    await db.delete(projects).where(eq(projects.id, projectId));
    expect(
      await db.select().from(aiCache).where(eq(aiCache.projectId, projectId)),
    ).toHaveLength(0);
  });
});
