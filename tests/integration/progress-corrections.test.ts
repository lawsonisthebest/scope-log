import { afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
const identity = vi.hoisted(() => ({ id: null as string | null }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: identity.id }),
  currentUser: async () => null,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { db } from "../../app/lib/db";
import { projects, workspaces, timeEntries } from "../../app/lib/schema";
import {
  correctCompletion,
  correctTime,
  removeCompletion,
} from "../../app/skills/corrections";
import { updateProject } from "../../app/workspaces/actions";
import { deleteRecord } from "../../app/actions";
const owner = `corrections_${randomUUID()}`;
const other = `corrections_${randomUUID()}`;
let roomId: string, timeId: string;
function form(values: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    timeZone: "America/Denver",
    ...values,
  }))
    form.set(key, value);
  return form;
}
afterAll(async () => {
  await db.delete(workspaces).where(eq(workspaces.clerkId, owner));
});
describe.sequential("optional progress corrections", () => {
  it("corrects the completion day and preserves it through unrelated room edits", async () => {
    identity.id = owner;
    const [workspace] = await db
      .insert(workspaces)
      .values({ clerkId: owner, workspaceName: "Correction fixture" })
      .returning();
    const [room] = await db
      .insert(projects)
      .values({
        clerkId: owner,
        workspaceId: workspace.id,
        projectName: "Backdated room",
        status: "Complete",
        progress: 100,
        completedAt: new Date(),
      })
      .returning();
    roomId = room.id;
    expect(
      (await correctCompletion(form({ projectId: roomId, date: "2026-09-15" })))
        .ok,
    ).toBe(true);
    expect(
      (
        await updateProject(roomId, {
          name: "Renamed",
          description: "",
          status: "Complete",
          priority: "Medium",
          dueDate: "",
          progress: 100,
        })
      ).ok,
    ).toBe(true);
    const [updated] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, roomId));
    expect(updated.completedOn).toBe("2026-09-15");
    const [time] = await db
      .insert(timeEntries)
      .values({
        clerkId: owner,
        workspaceId: workspace.id,
        projectId: roomId,
        minutes: 120,
        durationSeconds: 7200,
        createdAt: new Date("2026-09-16T07:00:00Z"),
        intervals: [
          {
            startedAt: "2026-09-16T05:00:00Z",
            endedAt: "2026-09-16T07:00:00Z",
          },
        ],
      })
      .returning();
    timeId = time.id;
    expect(
      (
        await correctTime(
          timeId,
          form({
            date: "2026-09-16",
            minutes: "120",
            seconds: "0",
            description: "Description only",
          }),
        )
      ).ok,
    ).toBe(true);
    const [preserved] = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, timeId));
    expect(preserved.intervals).toHaveLength(1);
    expect(preserved.recordedOn).toBeNull();
    expect(
      (
        await correctTime(
          timeId,
          form({
            date: "2026-09-15",
            minutes: "45",
            seconds: "30",
            description: "Corrected",
          }),
        )
      ).ok,
    ).toBe(true);
    const [corrected] = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, timeId));
    expect(corrected.recordedOn).toBe("2026-09-15");
    expect(corrected.durationSeconds).toBe(2730);
    expect(corrected.intervals).toEqual([]);
  });
  it("rejects invalid and unauthorized edits or deletions", async () => {
    for (const date of ["2099-01-01", "2026-02-30", ""])
      expect(
        (await correctCompletion(form({ projectId: roomId, date }))).ok,
      ).toBe(false);
    expect(
      (
        await correctTime(
          timeId,
          form({ date: "2026-09-15", minutes: "1440", seconds: "1" }),
        )
      ).ok,
    ).toBe(false);
    identity.id = other;
    expect(
      (await correctCompletion(form({ projectId: roomId, date: "2026-09-15" })))
        .ok,
    ).toBe(false);
    expect(
      (
        await correctTime(
          timeId,
          form({ date: "2026-09-15", minutes: "45", seconds: "0" }),
        )
      ).ok,
    ).toBe(false);
    expect((await removeCompletion(roomId)).ok).toBe(false);
    expect((await deleteRecord("time", timeId)).ok).toBe(false);
    identity.id = null;
    expect(
      (await correctCompletion(form({ projectId: roomId, date: "2026-09-15" })))
        .ok,
    ).toBe(false);
  });
  it("removes a completion without deleting the room and deletes only the selected time entry", async () => {
    identity.id = owner;
    expect((await removeCompletion(roomId)).ok).toBe(true);
    const [room] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, roomId));
    expect(room.status).toBe("Incomplete");
    expect(room.completedAt).toBeNull();
    expect(room.completedOn).toBeNull();
    expect(
      await db.select().from(timeEntries).where(eq(timeEntries.id, timeId)),
    ).toHaveLength(1);
    expect((await deleteRecord("time", timeId)).ok).toBe(true);
    expect(
      await db.select().from(timeEntries).where(eq(timeEntries.id, timeId)),
    ).toHaveLength(0);
    expect(
      await db.select().from(projects).where(eq(projects.id, roomId)),
    ).toHaveLength(1);
  });
});
