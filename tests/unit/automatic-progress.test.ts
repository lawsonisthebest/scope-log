import { describe, expect, it } from "vitest";
import {
  activityStreak,
  automaticEntries,
  runningInterval,
  splitTime,
  summarizeProgress,
  type AutomaticProgress,
} from "../../app/lib/progress";
const now = Date.parse("2026-09-30T20:00:00Z");
const room = {
  id: "room",
  workspaceId: "workspace",
  name: "SQL room",
  status: "Complete",
  completedAt: "2026-09-30T01:00:00Z",
};
const time = {
  id: "session",
  projectId: "room",
  workspaceId: "workspace",
  description: null,
  createdAt: "2026-09-30T07:00:00Z",
  seconds: 7200,
  intervals: [
    { startedAt: "2026-09-30T05:00:00Z", endedAt: "2026-09-30T07:00:00Z" },
  ],
};
describe("automatic progress accuracy", () => {
  it("places completions on their local day and splits time across midnight", () => {
    const entries = automaticEntries(
      { rooms: [room], time: [time], timers: [] },
      "America/Denver",
      now,
    );
    expect(entries.find((row) => row.completed)?.date).toBe("2026-09-29");
    expect(
      entries
        .filter((row) => row.minutes > 0)
        .map((row) => [row.date, row.minutes]),
    ).toEqual([
      ["2026-09-29", 60],
      ["2026-09-30", 60],
    ]);
    expect(summarizeProgress(entries)).toEqual({
      completed: 1,
      minutes: 120,
      days: 2,
      sessions: 1,
    });
    expect(activityStreak(entries, "2026-09-30")).toBe(2);
    expect(activityStreak(entries, "2026-10-01")).toBe(2);
    expect(activityStreak(entries, "2026-10-02")).toBe(0);
  });
  it("handles DST spring and autumn and half-hour timezone offsets", () => {
    const spring = splitTime(
      [{ startedAt: "2026-03-08T07:00:00Z", endedAt: "2026-03-09T06:00:00Z" }],
      "America/Denver",
      Date.parse("2026-11-03T00:00:00Z"),
    );
    expect([...spring]).toEqual([["2026-03-08", 23 * 3600]]);
    const fall = splitTime(
      [{ startedAt: "2026-11-01T06:00:00Z", endedAt: "2026-11-02T07:00:00Z" }],
      "America/Denver",
      Date.parse("2026-11-03T00:00:00Z"),
    );
    expect([...fall]).toEqual([["2026-11-01", 25 * 3600]]);
    expect([
      ...splitTime(
        [
          {
            startedAt: "2026-09-29T18:00:00Z",
            endedAt: "2026-09-29T19:00:00Z",
          },
        ],
        "Asia/Kolkata",
        now,
      ),
    ]).toEqual([
      ["2026-09-29", 1800],
      ["2026-09-30", 1800],
    ]);
  });
  it("counts paused intervals without the pause gap and deduplicates saved/live snapshots", () => {
    const timer = {
      ...time,
      status: "paused",
      elapsedSeconds: 3600,
      updatedAt: "2026-09-30T07:00:00Z",
      startedAt: "2026-09-30T06:30:00Z",
      intervals: [
        { startedAt: "2026-09-30T05:00:00Z", endedAt: "2026-09-30T05:30:00Z" },
        { startedAt: "2026-09-30T06:30:00Z", endedAt: "2026-09-30T07:00:00Z" },
      ],
    };
    const data: AutomaticProgress = {
      rooms: [room],
      time: [],
      timers: [timer],
    };
    expect(
      summarizeProgress(automaticEntries(data, "America/Denver", now)).minutes,
    ).toBe(60);
    expect(
      summarizeProgress(
        automaticEntries(
          {
            ...data,
            time: [{ ...time, seconds: 3600, intervals: timer.intervals }],
          },
          "America/Denver",
          now,
        ),
      ).minutes,
    ).toBe(60);
    expect(runningInterval(timer.startedAt, 3600, "paused", now)).toEqual([]);
    expect(runningInterval("2026-09-30T19:00:00Z", 0, "running", now)).toEqual([
      {
        startedAt: "2026-09-30T19:00:00Z",
        endedAt: "2026-09-30T20:00:00.000Z",
      },
    ]);
  });
  it("does not invent dates for old completions or count reopened rooms", () => {
    const entries = automaticEntries(
      {
        rooms: [
          { ...room, completedAt: null },
          { ...room, id: "reopened", status: "Incomplete" },
        ],
        time: [{ ...time, intervals: [] }],
        timers: [],
      },
      "America/Denver",
      now,
    );
    expect(summarizeProgress(entries)).toEqual({
      completed: 0,
      minutes: 120,
      days: 1,
      sessions: 1,
    });
    expect(entries[0].date).toBe("2026-09-30");
  });
});

it("uses corrected date-only values in every timezone without counting original dates", () => {
  const data: AutomaticProgress = {
    rooms: [{ ...room, completedOn: "2026-09-15" }],
    time: [{ ...time, recordedOn: "2026-09-15", intervals: [], seconds: 1800 }],
    timers: [],
  };
  for (const zone of [
    "America/Denver",
    "Pacific/Kiritimati",
    "Pacific/Honolulu",
  ]) {
    const entries = automaticEntries(data, zone, now);
    expect(entries.map((entry) => entry.date)).toEqual([
      "2026-09-15",
      "2026-09-15",
    ]);
    expect(summarizeProgress(entries)).toEqual({
      completed: 1,
      minutes: 30,
      days: 1,
      sessions: 1,
    });
  }
});
