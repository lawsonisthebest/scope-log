"use server";
import { and, eq } from "drizzle-orm";
import { db } from "../lib/db";
import { projects, timeEntries } from "../lib/schema";
import { attempt, refreshData, session } from "../lib/action-utils";
import { dueDate, id, integer, text, ValidationError } from "../lib/validation";
import { dateInZone } from "../lib/progress";

function correctionDate(form: FormData) {
  const date = text(form.get("date"), "Date", 10);
  if (!dueDate(date)) throw new ValidationError("Enter a valid date.");
  const zone = text(form.get("timeZone"), "Time zone", 100);
  let today: string;
  try {
    today = dateInZone(new Date().toISOString(), zone);
  } catch {
    throw new ValidationError("Invalid time zone.");
  }
  if (date > today)
    throw new ValidationError("Choose today or an earlier date.");
  return { date, zone };
}

export async function correctCompletion(form: FormData) {
  return attempt(async () => {
    const clerkId = await session(),
      projectId = id(form.get("projectId")),
      { date } = correctionDate(form);
    const [room] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.clerkId, clerkId)))
      .limit(1);
    if (!room) throw new ValidationError("Room not found.");
    await db
      .update(projects)
      .set({
        status: "Complete",
        progress: 100,
        completedOn: date,
        completedAt: room.completedAt || new Date(),
        lastUpdated: new Date(),
      })
      .where(and(eq(projects.id, projectId), eq(projects.clerkId, clerkId)));
    refreshData();
    return { date };
  });
}

export async function removeCompletion(projectId: string) {
  return attempt(async () => {
    const clerkId = await session();
    const [room] = await db
      .update(projects)
      .set({
        status: "Incomplete",
        progress: 0,
        completedAt: null,
        completedOn: null,
        lastUpdated: new Date(),
      })
      .where(and(eq(projects.id, id(projectId)), eq(projects.clerkId, clerkId)))
      .returning({ id: projects.id });
    if (!room) throw new ValidationError("Room not found.");
    refreshData();
  });
}

export async function correctTime(recordId: string, form: FormData) {
  return attempt(async () => {
    const clerkId = await session(),
      { date, zone } = correctionDate(form);
    const [row] = await db
      .select()
      .from(timeEntries)
      .where(
        and(eq(timeEntries.id, id(recordId)), eq(timeEntries.clerkId, clerkId)),
      )
      .limit(1);
    if (!row)
      throw new ValidationError(
        "Saved time entry not found. Stop the timer before editing it.",
      );
    const seconds =
      integer(form.get("minutes"), 0, 1440, "Minutes") * 60 +
      integer(form.get("seconds"), 0, 59, "Seconds");
    integer(seconds, 1, 86400, "Total seconds");
    const changed =
      date !==
        (row.recordedOn || dateInZone(row.createdAt.toISOString(), zone)) ||
      seconds !== (row.durationSeconds ?? row.minutes * 60);
    await db
      .update(timeEntries)
      .set({
        description: text(form.get("description"), "Description", 2000, true),
        minutes: Math.ceil(seconds / 60),
        durationSeconds: seconds,
        ...(changed ? { recordedOn: date, intervals: [] } : {}),
      })
      .where(
        and(eq(timeEntries.id, recordId), eq(timeEntries.clerkId, clerkId)),
      );
    refreshData();
    return { date };
  });
}
