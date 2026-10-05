import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "../lib/db";
import { projects, timeEntries, timerSessions } from "../lib/schema";
import { ProgressDashboard } from "./progress-dashboard";

export default async function ProgressPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const [rooms, time, timers] = await db.batch([
    db.select().from(projects).where(eq(projects.clerkId, userId)),
    db.select().from(timeEntries).where(eq(timeEntries.clerkId, userId)),
    db.select().from(timerSessions).where(eq(timerSessions.clerkId, userId)),
  ]);
  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Your learning activity</p>
        <h1>Progress</h1>
        <p>
          Your completed rooms and tracked time, brought together automatically.
        </p>
      </header>
      <ProgressDashboard
        now={new Date().toISOString()}
        data={{
          rooms: rooms.map((row) => ({
            id: row.id,
            workspaceId: row.workspaceId,
            name: row.projectName || "Untitled room",
            status: row.status || "Incomplete",
            completedAt: row.completedAt?.toISOString() || null,
            completedOn: row.completedOn,
          })),
          time: time.map((row) => ({
            id: row.id,
            projectId: row.projectId,
            workspaceId: row.workspaceId,
            description: row.description,
            createdAt: row.createdAt.toISOString(),
            seconds: row.durationSeconds ?? row.minutes * 60,
            recordedOn: row.recordedOn,
            intervals: row.intervals,
          })),
          timers: timers.map((row) => ({
            id: row.id,
            projectId: row.projectId,
            workspaceId: row.workspaceId,
            description: row.description,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            startedAt: row.startedAt.toISOString(),
            elapsedSeconds: row.elapsedSeconds,
            status: row.status,
            intervals: row.intervals,
          })),
        }}
      />
    </div>
  );
}
