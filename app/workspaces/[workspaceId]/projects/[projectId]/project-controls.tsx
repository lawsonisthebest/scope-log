"use client";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CirclePause,
  CirclePlay,
  LoaderCircle,
  Square,
} from "lucide-react";
import {
  logTime,
  pauseTimer,
  resumeTimer,
  startTimer,
  stopTimer,
} from "@/app/actions";
import { ActionForm, Field, HiddenScope } from "@/app/components/ui";
import { completeProject } from "@/app/workspaces/actions";

export type TimerSession = {
  id: string;
  status: string;
  elapsedSeconds: number;
  startedAt: string;
  description: string;
};

export function CompleteProjectButton({
  projectId,
  complete,
}: {
  projectId: string;
  complete: boolean;
}) {
  const router = useRouter(),
    [pending, startTransition] = useTransition(),
    [celebrating, setCelebrating] = useState(false),
    [error, setError] = useState("");
  const finish = () =>
    startTransition(async () => {
      setError("");
      const result = await completeProject(projectId).catch(() => ({
        ok: false as const,
        error: "Connection interrupted. Please try again.",
      }));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCelebrating(true);
      window.setTimeout(() => {
        setCelebrating(false);
        router.refresh();
      }, 1700);
    });
  if (complete && !celebrating)
    return (
      <span className="project-complete-label">
        <Check size={15} />
        Completed
      </span>
    );
  return (
    <div className="completion-control">
      <button
        className={`button complete-button ${celebrating ? "is-celebrating" : ""}`}
        disabled={pending || celebrating}
        onClick={finish}
      >
        {pending ? (
          <LoaderCircle className="animate-spin" size={15} />
        ) : (
          <Check size={15} />
        )}{" "}
        {celebrating ? "Project complete!" : "Complete project"}
      </button>
      {celebrating && (
        <div className="celebration" aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <i key={i} style={{ "--i": i } as CSSProperties} />
          ))}
        </div>
      )}
      {error && (
        <span className="control-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function ProjectTimer({
  workspaceId,
  projectId,
  initial,
}: {
  workspaceId: string;
  projectId: string;
  initial: TimerSession | null;
}) {
  const router = useRouter(),
    [session, setSession] = useState(initial),
    [description, setDescription] = useState(initial?.description || ""),
    [now, setNow] = useState(() =>
      initial ? new Date(initial.startedAt).getTime() : 0,
    ),
    [pending, startTransition] = useTransition(),
    [error, setError] = useState("");
  const [mode, setMode] = useState<"timer" | "manual">(
    initial ? "timer" : "manual",
  );
  useEffect(() => {
    if (session?.status !== "running") return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [session?.status]);
  const seconds = useMemo(() => {
    if (!session) return 0;
    const active =
      session.status === "running"
        ? Math.max(
            0,
            Math.floor((now - new Date(session.startedAt).getTime()) / 1000),
          )
        : 0;
    return session.elapsedSeconds + active;
  }, [session, now]);
  const run = (
    operation: () => Promise<
      | { ok: true; data: TimerSession | { seconds: number } }
      | { ok: false; error: string }
    >,
    done = false,
  ) =>
    startTransition(async () => {
      setError("");
      let result;
      try {
        result = await operation();
      } catch {
        setError("Connection interrupted. Please try again.");
        return;
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (done) {
        setSession(null);
        setDescription("");
        router.refresh();
      } else {
        setSession(result.data as TimerSession);
        setNow(Date.now());
      }
    });
  return (
    <section
      id="focus-timer"
      className={`timer-card ${session?.status === "running" ? "is-running" : ""}`}
    >
      <div className="time-card-title">
        <p className="eyebrow">Focus & time</p>
        {session && (
          <span className="badge">
            {session.status === "running" ? "Running" : "Paused"}
          </span>
        )}
      </div>
      <div className="time-mode" role="group" aria-label="Time entry mode">
        <button
          aria-pressed={mode === "manual"}
          onClick={() => setMode("manual")}
        >
          Log time
        </button>
        <button
          aria-pressed={mode === "timer"}
          onClick={() => setMode("timer")}
        >
          Run timer
        </button>
      </div>
      {mode === "manual" ? (
        <>
          <p className="time-card-help">
            Already done? Add the time you spent.
          </p>
          <ActionForm action={logTime} label="Save time" reset>
            <HiddenScope workspaceId={workspaceId} projectId={projectId} />
            <Field label="Minutes spent">
              <input
                className="field"
                name="minutes"
                type="number"
                min={1}
                max={1440}
                step={1}
                required
                placeholder="e.g. 45"
              />
            </Field>
            <Field label="Session note (optional)">
              <input
                className="field"
                name="description"
                maxLength={2000}
                placeholder="What did you work on?"
              />
            </Field>
          </ActionForm>
          {session && (
            <button
              className="time-session-link"
              onClick={() => setMode("timer")}
            >
              Timer {session.status === "running" ? "still running" : "paused"}{" "}
              · {clock(seconds)} →
            </button>
          )}
        </>
      ) : (
        <>
          <div className="timer-heading">
            <div>
              <h2>
                {session
                  ? session.status === "running"
                    ? "Tracking time"
                    : "Timer paused"
                  : "Start a focused session"}
              </h2>
            </div>
            <div className="timer-display" aria-live="off">
              {clock(seconds)}
            </div>
          </div>
          <input
            className="field"
            aria-label="Timer description"
            maxLength={2000}
            placeholder="What are you working on?"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={pending}
          />
          <div className="timer-actions">
            {!session ? (
              <button
                className="button"
                disabled={pending}
                onClick={() =>
                  run(() => startTimer(workspaceId, projectId, description))
                }
              >
                <CirclePlay size={16} />
                Start timer
              </button>
            ) : (
              <>
                {session.status === "running" ? (
                  <button
                    className="button-secondary"
                    disabled={pending}
                    onClick={() => run(() => pauseTimer(session.id))}
                  >
                    <CirclePause size={16} />
                    Pause
                  </button>
                ) : (
                  <button
                    className="button"
                    disabled={pending}
                    onClick={() => run(() => resumeTimer(session.id))}
                  >
                    <CirclePlay size={16} />
                    Resume
                  </button>
                )}
                <button
                  className="button-secondary timer-stop"
                  disabled={pending}
                  onClick={() =>
                    run(() => stopTimer(session.id, description), true)
                  }
                >
                  <Square size={14} />
                  Stop &amp; save
                </button>
              </>
            )}
            {pending && (
              <LoaderCircle className="animate-spin timer-loader" size={16} />
            )}
            <span>Saved to this project when you stop.</span>
          </div>
        </>
      )}
      {error && (
        <p className="control-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
function clock(seconds: number) {
  const hours = Math.floor(seconds / 3600),
    minutes = Math.floor((seconds % 3600) / 60),
    secs = seconds % 60;
  return [hours, minutes, secs]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}
