export const progressKinds = [
  "Practice",
  "Course",
  "Lab",
  "Reading",
  "Project",
  "Other",
] as const;
export type ProgressEntry = {
  id: string;
  title: string;
  kind: string;
  date: string;
  completed: number;
  minutes: number;
  notes: string | null;
  skillId: string | null;
  source: "log" | "project" | "completion";
  href?: string;
};
// Keep manual calendar dates date-only so time zones cannot shift them.
export function dateInZone(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join("-");
}
export function shiftDay(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function monthDays(month: string) {
  const [year, number] = month.split("-").map(Number);
  return Array.from(
    { length: new Date(Date.UTC(year, number, 0)).getUTCDate() },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
}
export function summarizeProgress(entries: ProgressEntry[]) {
  return {
    completed: entries.reduce((sum, entry) => sum + entry.completed, 0),
    minutes: entries.reduce((sum, entry) => sum + entry.minutes, 0),
    days: new Set(entries.map((entry) => entry.date)).size,
    sessions: new Set(
      entries
        .filter((entry) => entry.source !== "completion")
        .map((entry) => entry.id),
    ).size,
  };
}
export function completionStreak(entries: ProgressEntry[], today: string) {
  const days = new Set(
    entries.filter((entry) => entry.completed > 0).map((entry) => entry.date),
  );
  let day = days.has(today) ? today : shiftDay(today, -1);
  let streak = 0;
  while (days.has(day)) {
    streak++;
    day = shiftDay(day, -1);
  }
  return streak;
}
export function durationLabel(minutes: number) {
  if (minutes > 0 && minutes < 1)
    return `${Math.max(1, Math.floor(minutes * 60))}s`;
  const rounded = Math.round(minutes);
  return rounded >= 60
    ? `${Math.floor(rounded / 60)}h ${rounded % 60}m`
    : `${rounded}m`;
}

export type TimeInterval = { startedAt: string; endedAt: string };
export type AutomaticRoom = {
  id: string;
  workspaceId: string;
  name: string;
  status: string;
  completedAt: string | null;
  completedOn?: string | null;
};
export type AutomaticTime = {
  id: string;
  projectId: string;
  workspaceId: string;
  description: string | null;
  createdAt: string;
  seconds: number;
  recordedOn?: string | null;
  intervals: TimeInterval[];
};
export type AutomaticTimer = Omit<AutomaticTime, "seconds"> & {
  status: string;
  elapsedSeconds: number;
  startedAt: string;
  updatedAt: string;
};
export type AutomaticProgress = {
  rooms: AutomaticRoom[];
  time: AutomaticTime[];
  timers: AutomaticTimer[];
};

export function runningInterval(
  startedAt: string,
  elapsedSeconds: number,
  status: string,
  now: number,
): TimeInterval[] {
  if (status !== "running") return [];
  const start = new Date(startedAt).getTime();
  const seconds = Math.min(
    Math.max(0, 86400 - elapsedSeconds),
    Math.max(0, Math.floor((now - start) / 1000)),
  );
  return seconds
    ? [{ startedAt, endedAt: new Date(start + seconds * 1000).toISOString() }]
    : [];
}

// Split at local midnight, including 23/25-hour DST days and non-hour offsets.
export function splitTime(
  intervals: TimeInterval[],
  zone: string,
  now: number,
) {
  const days = new Map<string, number>();
  for (const interval of intervals) {
    let start = new Date(interval.startedAt).getTime();
    const end = Math.min(now, new Date(interval.endedAt).getTime());
    while (Number.isFinite(start) && Number.isFinite(end) && start < end) {
      const day = dateInZone(new Date(start).toISOString(), zone);
      let boundary = Math.min(end, start + 26 * 3600000);
      if (dateInZone(new Date(boundary - 1).toISOString(), zone) !== day) {
        let low = start,
          high = boundary;
        while (high - low > 1) {
          const mid = Math.floor((low + high) / 2);
          if (dateInZone(new Date(mid).toISOString(), zone) === day) low = mid;
          else high = mid;
        }
        boundary = high;
      }
      days.set(day, (days.get(day) || 0) + (boundary - start) / 1000);
      start = boundary;
    }
  }
  return days;
}

export function automaticEntries(
  data: AutomaticProgress,
  zone: string,
  now: number,
): ProgressEntry[] {
  const entries: ProgressEntry[] = [];
  const roomMap = new Map(data.rooms.map((room) => [room.id, room]));
  for (const room of data.rooms) {
    if (
      room.status !== "Complete" ||
      (!room.completedAt && !room.completedOn) ||
      (room.completedOn
        ? room.completedOn > dateInZone(new Date(now).toISOString(), zone)
        : new Date(room.completedAt!).getTime() > now)
    )
      continue;
    entries.push({
      id: `room-${room.id}`,
      title: room.name,
      kind: room.name,
      date: room.completedOn || dateInZone(room.completedAt!, zone),
      completed: 1,
      minutes: 0,
      notes: null,
      skillId: null,
      source: "completion",
      href: `/workspaces/${room.workspaceId}/projects/${room.id}`,
    });
  }
  const savedIds = new Set(data.time.map((row) => row.id));
  const sessions = [
    ...data.time.map((row) => ({ ...row, live: false })),
    ...data.timers
      .filter((row) => !savedIds.has(row.id))
      .map((row) => {
        const active = runningInterval(
          row.startedAt,
          row.elapsedSeconds,
          row.status,
          now,
        );
        const activeSeconds = active.reduce(
          (sum, part) =>
            sum +
            (Date.parse(part.endedAt) - Date.parse(part.startedAt)) / 1000,
          0,
        );
        return {
          ...row,
          createdAt: row.updatedAt,
          intervals: [...row.intervals, ...active],
          seconds: row.elapsedSeconds + activeSeconds,
          live: row.status === "running",
        };
      }),
  ];
  for (const row of sessions) {
    const days = row.recordedOn
      ? new Map([[row.recordedOn, row.seconds]])
      : splitTime(row.intervals, zone, now);
    const allocated = [...days.values()].reduce((sum, value) => sum + value, 0);
    // Older records have totals only. Keep that time on its recorded date rather than invent intervals.
    const remaining = Math.max(0, row.seconds - allocated);
    if (remaining > 0 && Date.parse(row.createdAt) <= now) {
      const date = dateInZone(row.createdAt, zone);
      days.set(date, (days.get(date) || 0) + remaining);
    }
    const room = roomMap.get(row.projectId);
    for (const [date, seconds] of days) {
      if (seconds <= 0) continue;
      entries.push({
        id: `time-${row.id}`,
        title: row.description || room?.name || "Room session",
        kind: room?.name || "Room",
        date,
        completed: 0,
        minutes: seconds / 60,
        notes: row.live ? "Timer running" : "Tracked time",
        skillId: null,
        source: "project",
        href: `/workspaces/${row.workspaceId}/projects/${row.projectId}`,
      });
    }
  }
  return entries;
}

export function activityStreak(entries: ProgressEntry[], today: string) {
  return completionStreak(
    entries
      .filter((entry) => entry.completed > 0 || entry.minutes > 0)
      .map((entry) => ({ ...entry, completed: 1 })),
    today,
  );
}
