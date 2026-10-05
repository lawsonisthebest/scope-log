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
import {
  projects,
  workspaces,
  timeEntries,
  timerSessions,
} from "../../app/lib/schema";
import { completeProject, updateProject } from "../../app/workspaces/actions";
import {
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
} from "../../app/actions";
import type { ActionResult } from "../../app/lib/validation";
const owner = `auto_progress_${randomUUID()}`,
  other = `auto_progress_${randomUUID()}`;
let projectId: string, workspaceId: string;
function unwrap<T>(value: ActionResult<T>) {
  if (!value.ok) throw new Error(value.error);
  return value.data;
}
afterAll(async () => {
  await db.delete(workspaces).where(eq(workspaces.clerkId, owner));
});
describe.sequential("automatic completion and timer persistence", () => {
  it("stamps completion once, keeps it through edits and handles reopening", async () => {
    identity.id = owner;
    const [workspace] = await db
      .insert(workspaces)
      .values({ clerkId: owner, workspaceName: "Progress fixture" })
      .returning();
    workspaceId = workspace.id;
    const [room] = await db
      .insert(projects)
      .values({
        clerkId: owner,
        workspaceId,
        projectName: "Room",
        status: "Incomplete",
      })
      .returning();
    projectId = room.id;
    unwrap(await completeProject(projectId));
    const [completed] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    expect(completed.completedAt).toBeInstanceOf(Date);
    unwrap(await completeProject(projectId));
    const edit = {
      name: "Renamed room",
      description: "Edited",
      status: "Complete",
      priority: "Medium",
      dueDate: "",
      progress: 100,
    };
    unwrap(await updateProject(projectId, edit));
    const [renamed] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    expect(renamed.completedAt).toEqual(completed.completedAt);
    identity.id = other;
    expect((await completeProject(projectId)).ok).toBe(false);
    expect((await updateProject(projectId, edit)).ok).toBe(false);
    identity.id = owner;
    unwrap(
      await updateProject(projectId, {
        ...edit,
        status: "Incomplete",
        progress: 50,
      }),
    );
    const [reopened] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    expect(reopened.completedAt).toBeNull();
    unwrap(await updateProject(projectId, edit));
    const [recompleted] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    expect(recompleted.completedAt!.getTime()).toBeGreaterThan(
      completed.completedAt!.getTime(),
    );
  });
  it("preserves running intervals across pause/resume/stop and cannot save the same timer twice", async () => {
    identity.id = owner;
    const timer = unwrap(
      await startTimer(workspaceId, projectId, "Time fixture"),
    );
    await db
      .update(timerSessions)
      .set({ startedAt: new Date(Date.now() - 120000) })
      .where(eq(timerSessions.id, timer.id));
    unwrap(await pauseTimer(timer.id));
    const [paused] = await db
      .select()
      .from(timerSessions)
      .where(eq(timerSessions.id, timer.id));
    expect(paused.intervals).toHaveLength(1);
    expect(paused.elapsedSeconds).toBeGreaterThanOrEqual(120);
    unwrap(await pauseTimer(timer.id));
    unwrap(await resumeTimer(timer.id));
    await db
      .update(timerSessions)
      .set({ startedAt: new Date(Date.now() - 60000) })
      .where(eq(timerSessions.id, timer.id));
    identity.id = other;
    expect((await stopTimer(timer.id, "Stolen")).ok).toBe(false);
    identity.id = owner;
    const result = unwrap(await stopTimer(timer.id, "Saved session"));
    const [saved] = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, timer.id));
    expect(saved.intervals).toHaveLength(2);
    expect(saved.durationSeconds).toBe(result.seconds);
    expect(
      saved.intervals.reduce(
        (sum, interval) =>
          sum +
          (Date.parse(interval.endedAt) - Date.parse(interval.startedAt)) /
            1000,
        0,
      ),
    ).toBe(result.seconds);
    expect(
      await db
        .select()
        .from(timerSessions)
        .where(eq(timerSessions.id, timer.id)),
    ).toHaveLength(0);
    expect((await stopTimer(timer.id, "Duplicate")).ok).toBe(false);
    expect(
      await db
        .select()
        .from(timeEntries)
        .where(eq(timeEntries.projectId, projectId)),
    ).toHaveLength(1);
  });
});
