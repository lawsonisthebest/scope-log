"use server";
import { and, eq } from "drizzle-orm";
import { db } from "../lib/db";
import { progressLogs, skills } from "../lib/schema";
import { attempt, refreshData, session } from "../lib/action-utils";
import {
  choice,
  dueDate,
  id,
  integer,
  text,
  ValidationError,
} from "../lib/validation";
import { dateInZone, progressKinds } from "../lib/progress";

export async function saveProgressLog(recordId: string | null, form: FormData) {
  return attempt(async () => {
    const clerkId = await session();
    const loggedOn = text(form.get("date"), "Date", 10);
    if (!dueDate(loggedOn)) throw new ValidationError("Enter a valid date.");
    let today: string;
    try {
      today = dateInZone(
        new Date().toISOString(),
        text(form.get("timeZone"), "Time zone", 100, true) || "UTC",
      );
    } catch {
      throw new ValidationError("Choose a valid time zone.");
    }
    if (loggedOn > today)
      throw new ValidationError(
        "Progress can only be logged for today or an earlier date.",
      );
    const skillId = form.get("skillId")
      ? id(form.get("skillId"), "Skill")
      : null;
    if (skillId) {
      const [skill] = await db
        .select({ id: skills.id })
        .from(skills)
        .where(and(eq(skills.id, skillId), eq(skills.clerkId, clerkId)))
        .limit(1);
      if (!skill) throw new ValidationError("Skill not found.");
    }
    const values = {
      title: text(form.get("title"), "Activity title"),
      kind: choice(form.get("kind"), progressKinds, "Activity type"),
      loggedOn,
      skillId,
      completed: integer(form.get("completed"), 0, 10000, "Completed items"),
      minutes: integer(form.get("minutes"), 0, 1440, "Minutes"),
      notes: text(form.get("notes"), "Notes", 10000, true),
    };
    if (recordId) {
      const [updated] = await db
        .update(progressLogs)
        .set(values)
        .where(
          and(
            eq(progressLogs.id, id(recordId)),
            eq(progressLogs.clerkId, clerkId),
          ),
        )
        .returning({ id: progressLogs.id });
      if (!updated) throw new ValidationError("Progress log not found.");
    } else {
      await db.insert(progressLogs).values({ clerkId, ...values });
    }
    refreshData();
    return { date: loggedOn };
  });
}
export async function deleteProgressLog(recordId: string) {
  return attempt(async () => {
    const clerkId = await session();
    const [deleted] = await db
      .delete(progressLogs)
      .where(
        and(
          eq(progressLogs.id, id(recordId)),
          eq(progressLogs.clerkId, clerkId),
        ),
      )
      .returning({ id: progressLogs.id });
    if (!deleted) throw new ValidationError("Progress log not found.");
    refreshData();
  });
}
