"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  Pencil,
} from "lucide-react";
import { Empty, DeleteButton } from "../components/ui";
import { AIInsight } from "../components/ai-insight";
import { deleteRecord } from "../actions";
import { removeCompletion } from "./corrections";
import {
  ProgressCorrection,
  type CorrectionSelection,
} from "./progress-corrections";
import {
  activityStreak,
  automaticEntries,
  dateInZone,
  durationLabel,
  monthDays,
  summarizeProgress,
  type AutomaticProgress,
} from "../lib/progress";

const subscribe = () => () => {};
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverZone = () => "UTC";
function dateLabel(day: string, options: Intl.DateTimeFormatOptions) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    ...options,
    timeZone: "UTC",
  });
}

export function ProgressDashboard({
  data,
  now,
}: {
  data: AutomaticProgress;
  now: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CorrectionSelection | null>(null);
  const zone = useSyncExternalStore(subscribe, browserZone, serverZone);
  const [clock, setClock] = useState(Date.parse(now));
  useEffect(() => {
    const tick = window.setInterval(() => setClock(Date.now()), 1000);
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const sync = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(sync);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  const currentTime = Math.max(clock, Date.parse(now));
  const today = dateInZone(new Date(currentTime).toISOString(), zone);
  const [chosenMonth, setMonth] = useState<string | null>(null);
  const month = chosenMonth || today.slice(0, 7);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [metric, setMetric] = useState<"completed" | "minutes">("completed");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(10);
  const entries = automaticEntries(data, zone, currentTime);
  const monthly = entries.filter((entry) => entry.date.startsWith(month));
  const summary = summarizeProgress(monthly);
  const allTime = summarizeProgress(entries);
  const completedRooms = data.rooms.filter(
    (room) => room.status === "Complete",
  );
  const undated = completedRooms.filter(
    (room) => !room.completedAt && !room.completedOn,
  ).length;
  const days = monthDays(month);
  const daily = days.map((date) => ({
    date,
    ...summarizeProgress(monthly.filter((entry) => entry.date === date)),
  }));
  const maximum = Math.max(1, ...daily.map((day) => day[metric]));
  const selected = selectedDay
    ? entries.filter((entry) => entry.date === selectedDay)
    : monthly;
  const history = selected
    .filter((entry) =>
      `${entry.title} ${entry.kind}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.completed - a.completed);
  const categories = data.rooms
    .map((room) => ({
      room,
      minutes: monthly
        .filter(
          (entry) =>
            entry.href ===
            `/workspaces/${room.workspaceId}/projects/${room.id}`,
        )
        .reduce((sum, entry) => sum + entry.minutes, 0),
    }))
    .filter((row) => row.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
  const running = data.timers.filter(
    (timer) => timer.status === "running",
  ).length;
  function moveMonth(amount: number) {
    const date = new Date(`${month}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + amount);
    setMonth(date.toISOString().slice(0, 7));
    setSelectedDay(null);
    setLimit(10);
  }
  function chooseDay(day: string) {
    setSelectedDay(selectedDay === day ? null : day);
    setLimit(10);
  }

  return (
    <div className="progress-dashboard">
      <div className="progress-toolbar">
        <div>
          <span className="eyebrow">Automatically tracked</span>
          <p className="progress-muted">
            Room completions, saved time, and live timers. No progress logs
            needed.
          </p>
        </div>
        <span className="badge">
          {running
            ? `${running} timer${running === 1 ? "" : "s"} running`
            : "Connected to your activity"}
        </span>
      </div>
      {data.rooms.length > 0 && (
        <div>
          <button
            className="button-secondary"
            onClick={() => setEditing({ kind: "completion", id: "" })}
          >
            <Pencil size={14} />
            Change completion date
          </button>
        </div>
      )}
      <div className="progress-lifetime">
        <span>
          <strong>{completedRooms.length}</strong> rooms completed overall
        </span>
        <span>
          <strong>{durationLabel(allTime.minutes)}</strong> total time
        </span>
        <span>
          <strong>{data.rooms.length - completedRooms.length}</strong> rooms in
          progress
        </span>
      </div>
      {undated > 0 && (
        <p className="progress-muted">
          {undated} older completed room{undated === 1 ? " has" : "s have"} no
          recorded completion date. Included in the overall total, but excluded
          from the calendar and streaks.
        </p>
      )}
      <div className="progress-period">
        <button
          className="icon-button"
          aria-label="Previous month"
          onClick={() => moveMonth(-1)}
        >
          <ChevronLeft size={18} />
        </button>
        <h2>{dateLabel(`${month}-01`, { month: "long", year: "numeric" })}</h2>
        <button
          className="icon-button"
          aria-label="Next month"
          disabled={month >= today.slice(0, 7)}
          onClick={() => moveMonth(1)}
        >
          <ChevronRight size={18} />
        </button>
        <button
          className="button-secondary"
          onClick={() => {
            setMonth(null);
            setSelectedDay(null);
          }}
        >
          This month
        </button>
      </div>
      <div className="progress-stats">
        {[
          {
            label: "Rooms completed",
            value: summary.completed,
            detail: "Completed in the selected month",
            icon: CheckCheck,
          },
          {
            label: "Time spent",
            value: durationLabel(summary.minutes),
            detail: `${summary.sessions} tracked sessions this month`,
            icon: Clock3,
          },
          {
            label: "Active days",
            value: `${summary.days} / ${days.filter((day) => day <= today).length}`,
            detail: "Days with time or a room completion",
            icon: CalendarDays,
          },
          {
            label: "Current streak",
            value: `${activityStreak(entries, today)} days`,
            detail: "Consecutive active days · as of today",
            icon: Flame,
          },
        ].map((stat) => (
          <section className="panel progress-stat" key={stat.label}>
            <div>
              <span>{stat.label}</span>
              <stat.icon size={17} />
            </div>
            <strong>{stat.value}</strong>
            <p>{stat.detail}</p>
          </section>
        ))}
      </div>
      <AIInsight key={`${month}:${zone}`} request={{ kind: "progress", month, timeZone: zone }} />
      <div className="progress-main-grid">
        <section className="panel progress-calendar">
          <div className="panel-heading">
            <h2>Activity calendar</h2>
            <span className="progress-muted">Select a day for details</span>
          </div>
          <div className="progress-weekdays">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="progress-days">
            {Array.from(
              {
                length: (new Date(`${month}-01T12:00:00Z`).getUTCDay() + 6) % 7,
              },
              (_, index) => (
                <span key={`blank-${index}`} />
              ),
            )}
            {daily.map((day) => (
              <button
                key={day.date}
                disabled={day.date > today}
                onClick={() => chooseDay(day.date)}
                aria-pressed={selectedDay === day.date}
                aria-label={`${dateLabel(day.date, { month: "long", day: "numeric" })}: ${day.completed} rooms completed, ${durationLabel(day.minutes)}`}
                className={`progress-day ${day.date === today ? "is-today" : ""} ${selectedDay === day.date ? "is-selected" : ""}`}
                data-level={
                  day.completed >= 5
                    ? 3
                    : day.completed >= 2
                      ? 2
                      : day.completed
                        ? 1
                        : 0
                }
                data-active={day.minutes > 0}
              >
                <span>{Number(day.date.slice(-2))}</span>
                <strong>
                  {day.completed
                    ? `${day.completed} done`
                    : day.minutes > 0
                      ? "Active"
                      : "—"}
                </strong>
                <small>
                  {day.minutes > 0 ? durationLabel(day.minutes) : ""}
                </small>
              </button>
            ))}
          </div>
          <div className="progress-legend">
            <span>Rooms completed</span>
            {[0, 1, 2, 3].map((level, index) => (
              <span className="flex items-center gap-1" key={level}>
                <i data-level={level} />
                {["0", "1", "2–4", "5+"][index]}
              </span>
            ))}
          </div>
          <p className="progress-muted mt-3">
            A day is active when you track time or complete a room. Today can
            remain empty without breaking yesterday’s streak.
          </p>
        </section>
        <section className="panel progress-breakdown">
          <div className="panel-heading">
            <h2>Time by room</h2>
            <Clock3 size={16} />
          </div>
          <strong className="progress-total">
            {durationLabel(summary.minutes)}
          </strong>
          <p className="progress-muted mb-6">
            Where you spent your time this month
          </p>
          {categories.length ? (
            <div className="progress-room-breakdown">
              {categories.map(({ room, minutes }, index) => (
                <div className="progress-category" key={room.id}>
                  <div>
                    <Link
                      href={`/workspaces/${room.workspaceId}/projects/${room.id}`}
                      className="progress-room-name"
                    >
                      {room.name}
                    </Link>
                    <strong>{durationLabel(minutes)}</strong>
                  </div>
                  <div className="progress-track">
                    <span
                      style={{
                        display: "block",
                        width: `${(minutes / summary.minutes) * 100}%`,
                        background: [
                          "#9ccbad",
                          "#91bdda",
                          "#d1bc8b",
                          "#b4a1d6",
                        ][index % 4],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty>
              Time appears here automatically as you use your room timer.
            </Empty>
          )}
          <p className="progress-muted mt-6">
            Running and paused timers are included before you save. Paused time
            does not accumulate.
          </p>
        </section>
      </div>
      <section className="panel progress-chart-panel">
        <div className="panel-heading">
          <div>
            <h2>Daily progression</h2>
            <p className="progress-muted mt-1">
              {metric === "completed" ? "Rooms completed" : "Minutes tracked"}{" "}
              per day
            </p>
          </div>
          <select
            className="field progress-metric"
            aria-label="Chart metric"
            value={metric}
            onChange={(event) =>
              setMetric(event.target.value as "completed" | "minutes")
            }
          >
            <option value="completed">Completions</option>
            <option value="minutes">Time spent</option>
          </select>
        </div>
        <div
          className="progress-chart"
          role="group"
          aria-label="Daily activity chart"
        >
          <span className="progress-chart-max">
            {Math.ceil(maximum)} {metric === "minutes" ? "min" : "rooms"}
          </span>
          <div className="progress-bars">
            {daily.map((day) => (
              <button
                key={day.date}
                disabled={day.date > today}
                aria-label={`${day.date}: ${metric === "minutes" ? durationLabel(day.minutes) : `${day.completed} rooms completed`}`}
                title={`${day.date}: ${metric === "minutes" ? durationLabel(day.minutes) : `${day.completed} rooms completed`}`}
                aria-pressed={selectedDay === day.date}
                onClick={() => chooseDay(day.date)}
              >
                <span className="progress-bar-space">
                  <i
                    style={{
                      height: `${Math.max(day[metric] ? 2 : 0, (day[metric] / maximum) * 100)}%`,
                    }}
                  />
                </span>
                <small>
                  {Number(day.date.slice(-2)) % 5 === 0 ||
                  day.date.endsWith("01")
                    ? Number(day.date.slice(-2))
                    : ""}
                </small>
              </button>
            ))}
          </div>
        </div>
        {!monthly.length && (
          <p className="progress-muted mt-3">
            No activity this month yet. Your room completions and tracked time
            will appear automatically.
          </p>
        )}
      </section>
      <section className="panel progress-history">
        <div className="panel-heading">
          <div>
            <h2>
              {selectedDay
                ? dateLabel(selectedDay, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Activity history"}
            </h2>
            <p className="progress-muted mt-1">
              {selectedDay ? "Activity for this day" : "Activity this month"} ·{" "}
              {history.length} records
            </p>
          </div>
          {selectedDay && (
            <button
              className="button-secondary"
              onClick={() => setSelectedDay(null)}
            >
              Show full month
            </button>
          )}
        </div>
        <input
          className="field mb-4"
          aria-label="Search activity"
          placeholder="Search rooms and sessions…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setLimit(10);
          }}
        />
        {history.length ? (
          history.slice(0, limit).map((entry) => (
            <article className="progress-log" key={`${entry.id}-${entry.date}`}>
              <div className="progress-log-date">
                <strong>{Number(entry.date.slice(-2))}</strong>
                <span>{dateLabel(entry.date, { month: "short" })}</span>
              </div>
              <div className="progress-log-content">
                <h3>{entry.title}</h3>
                <p>
                  {entry.completed
                    ? "Room completed"
                    : `${entry.kind} · ${entry.notes}`}
                </p>
              </div>
              <div className="progress-log-values">
                <strong>
                  {entry.completed ? "Completed" : durationLabel(entry.minutes)}
                </strong>
              </div>
              {entry.source === "completion" ? (
                <div className="flex gap-1">
                  <button
                    className="icon-button"
                    aria-label={`Edit completion ${entry.title}`}
                    onClick={() =>
                      setEditing({ kind: "completion", id: entry.id.slice(5) })
                    }
                  >
                    <Pencil size={14} />
                  </button>
                  <DeleteButton
                    name={entry.title}
                    label="Remove completion"
                    action={() => removeCompletion(entry.id.slice(5))}
                    description="This removes the completion and resets the room to incomplete (0%). The room, research, and time entries are kept."
                  />
                </div>
              ) : data.time.some((row) => `time-${row.id}` === entry.id) ? (
                <div className="flex gap-1">
                  <button
                    className="icon-button"
                    aria-label={`Edit time ${entry.title}`}
                    onClick={() =>
                      setEditing({ kind: "time", id: entry.id.slice(5) })
                    }
                  >
                    <Pencil size={14} />
                  </button>
                  <DeleteButton
                    name={entry.title}
                    action={() => deleteRecord("time", entry.id.slice(5))}
                    description="This permanently deletes the entire saved time session, including any time on other days. The room is kept."
                  />
                </div>
              ) : (
                <span className="progress-muted">Stop timer to edit</span>
              )}
              <Link
                href={entry.href!}
                className="icon-button"
                aria-label={`Open room for ${entry.title}`}
              >
                <ArrowUpRight size={16} />
              </Link>
            </article>
          ))
        ) : (
          <Empty>
            {search
              ? "No activity matches your search."
              : "No activity for this period yet."}
          </Empty>
        )}
        {history.length > limit && (
          <button
            className="button-secondary mt-4"
            onClick={() => setLimit(limit + 10)}
          >
            Show more activity
          </button>
        )}
      </section>
      {editing && (
        <ProgressCorrection
          selection={editing}
          data={data}
          zone={zone}
          today={today}
          onClose={() => setEditing(null)}
          onSaved={(date) => {
            setMonth(date.slice(0, 7));
            setSelectedDay(null);
          }}
        />
      )}
      <p className="progress-muted">
        Dates use {zone}. Live time updates every second; room data syncs every
        30 seconds and when you return to this page. Older time entries without
        interval history appear on their recorded date.
      </p>
    </div>
  );
}
