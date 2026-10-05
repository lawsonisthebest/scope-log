import { afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
const identity = vi.hoisted(() => ({ id: null as string | null }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: identity.id }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { db } from "../../app/lib/db";
import { progressLogs, skills } from "../../app/lib/schema";
import { saveProgressLog, deleteProgressLog } from "../../app/skills/actions";
import { GET as exportData } from "../../app/api/export/route";
const owner = `progress_test_${randomUUID()}`,
  other = `progress_test_${randomUUID()}`;
function form(overrides: Record<string, string> = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({
    title: "Finished labs",
    date: "2026-01-10",
    kind: "Lab",
    completed: "3",
    minutes: "45",
    notes: "Learned something",
    timeZone: "America/Denver",
    ...overrides,
  }))
    result.set(key, value);
  return result;
}
afterAll(async () => {
  for (const clerkId of [owner, other]) {
    await db.delete(progressLogs).where(eq(progressLogs.clerkId, clerkId));
    await db.delete(skills).where(eq(skills.clerkId, clerkId));
  }
});
describe.sequential("progress persistence and isolation", () => {
  it("rejects signed-out writes and malformed values", async () => {
    expect((await saveProgressLog(null, form())).ok).toBe(false);
    identity.id = owner;
    const invalidValues: Record<string, string>[] = [
      { date: "2026-02-30" },
      { date: "2099-01-01" },
      { completed: "-1" },
      { completed: "1.5" },
      { minutes: "1441" },
      { kind: "Bad" },
      { timeZone: "invalid" },
    ];
    for (const values of invalidValues)
      expect((await saveProgressLog(null, form(values))).ok).toBe(false);
  });
  it("creates, updates, exports and deletes logs while enforcing ownership", async () => {
    identity.id = owner;
    const [skill] = await db
      .insert(skills)
      .values({ clerkId: owner, name: "Testing", category: "Security" })
      .returning();
    expect((await saveProgressLog(null, form({ skillId: skill.id }))).ok).toBe(
      true,
    );
    const [row] = await db
      .select()
      .from(progressLogs)
      .where(eq(progressLogs.clerkId, owner));
    expect(row.loggedOn).toBe("2026-01-10");
    expect(row.completed).toBe(3);
    identity.id = other;
    expect((await saveProgressLog(null, form({ skillId: skill.id }))).ok).toBe(
      false,
    );
    expect(
      (await saveProgressLog(row.id, form({ title: "Wrong owner" }))).ok,
    ).toBe(false);
    expect((await deleteProgressLog(row.id)).ok).toBe(false);
    expect((await (await exportData()).json()).progressLogs).toHaveLength(0);
    identity.id = owner;
    expect(
      (
        await saveProgressLog(
          row.id,
          form({ completed: "5", minutes: "60", skillId: skill.id }),
        )
      ).ok,
    ).toBe(true);
    expect((await (await exportData()).json()).progressLogs[0].completed).toBe(
      5,
    );
    await db.delete(skills).where(eq(skills.id, skill.id));
    const [retained] = await db
      .select()
      .from(progressLogs)
      .where(eq(progressLogs.id, row.id));
    expect(retained.skillId).toBeNull();
    expect(retained.completed).toBe(5);
    expect((await deleteProgressLog(row.id)).ok).toBe(true);
    expect(
      await db
        .select()
        .from(progressLogs)
        .where(eq(progressLogs.clerkId, owner)),
    ).toHaveLength(0);
  });
});
