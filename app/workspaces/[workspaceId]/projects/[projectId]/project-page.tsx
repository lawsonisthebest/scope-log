"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Pencil,
  Plus,
  ShieldAlert,
  StickyNote,
  Timer,
  Users,
} from "lucide-react";
import {
  addTeamMember,
  createReport,
  deleteRecord,
  removeTeamMember,
  updateFindingStatus,
} from "@/app/actions";
import { updateProject } from "@/app/workspaces/actions";
import {
  ActionForm,
  Badge,
  DeleteButton,
  Empty,
  Field,
  HiddenScope,
  Modal,
  Panel,
} from "@/app/components/ui";
import {
  EvidenceForm,
  FindingForm,
  NoteForm,
  type Evidence,
  type Finding,
  type Note,
} from "@/app/components/record-forms";
import { PageHeaderContent } from "@/app/components/header-slots";
import { AIInsight } from "@/app/components/ai-insight";
import {
  CompleteProjectButton,
  ProjectTimer,
  type TimerSession,
} from "./project-controls";
type Project = {
  id: string;
  name: string;
  description: string;
  status: string;
  priority: string;
  progress: number;
  dueDate: string;
  updated: string;
};
type Report = {
  id: string;
  name: string;
  content: string;
  status: string;
  updatedAt: string;
};
type Member = { id: string; name: string; email: string; role: string };
type TimeEntry = {
  recordedOn?: string | null;
  id: string;
  minutes: number;
  durationSeconds: number | null;
  description: string | null;
  createdAt: string;
};
type Activity = {
  id: string;
  message: string;
  type: string;
  createdAt: string;
};
type Capture = "finding" | "evidence" | "report" | "note" | "setup" | "contact";

export function ProjectPage({
  workspaceId,
  workspaceName,
  activityPage,
  activityPages,
  project,
  findings,
  evidence,
  reports,
  members,
  notes,
  timeEntries,
  timerSession,
  activities,
}: {
  workspaceId: string;
  workspaceName: string;
  activityPage: number;
  activityPages: number;
  project: Project;
  findings: Finding[];
  evidence: Evidence[];
  reports: Report[];
  members: Member[];
  notes: Note[];
  timeEntries: TimeEntry[];
  timerSession: TimerSession | null;
  activities: Activity[];
}) {
  const searchParams = useSearchParams(),
    router = useRouter();
  const activityHref = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("activityPage", String(page));
    params.set("tab", tab);
    return `?${params}`;
  };
  const requestedTab = searchParams.get("tab");
  const [modal, setModal] = useState<Capture | null>(null),
    [tab, setTab] = useState(
      requestedTab &&
        [
          "Findings",
          "Evidence",
          "Reports",
          "Notes",
          "Time log",
          "Contacts",
        ].includes(requestedTab)
        ? requestedTab
        : "Findings",
    ),
    [query, setQuery] = useState("");
  const [editingFinding, setEditingFinding] = useState<Finding>(),
    [editingEvidence, setEditingEvidence] = useState<Evidence>(),
    [editingNote, setEditingNote] = useState<Note>();
  const close = () => {
    setModal(null);
    setEditingFinding(undefined);
    setEditingEvidence(undefined);
    setEditingNote(undefined);
  };
  const scope = { workspaceId, projectId: project.id, onSaved: close };
  const matches = (value: string) =>
    value.toLowerCase().includes(query.toLowerCase());
  const totalSeconds = timeEntries.reduce(
    (sum, entry) => sum + (entry.durationSeconds ?? entry.minutes * 60),
    0,
  );
  const tabs = [
    ["Findings", findings.length],
    ["Evidence", evidence.length],
    ["Reports", reports.length],
    ["Notes", notes.length],
    ["Time log", timeEntries.length],
    ["Contacts", members.length],
  ] as const;
  const activeCapture: Capture =
    tab === "Findings"
      ? "finding"
      : tab === "Evidence"
        ? "evidence"
        : tab === "Reports"
          ? "report"
          : tab === "Notes"
            ? "note"
            : "contact";
  return (
    <div className="page">
      <PageHeaderContent
        breadcrumb={
          <nav aria-label="Breadcrumb" className="project-breadcrumb">
            <Link href="/workspaces">Workspaces</Link>
            <ChevronRight size={13} />
            <Link href={`/workspaces/${workspaceId}`}>{workspaceName}</Link>
            <ChevronRight size={13} />
            <span aria-current="page" title={project.name}>
              {project.name}
            </span>
          </nav>
        }
      />
      <header className="page-header mt-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Security assessment</p>
            <h1 className="break-words">{project.name}</h1>
            <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-[#99a8b1]">
              {project.description ||
                "Define the scope, capture your research, and build a clear assessment."}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[#99a8b1]">
          <Badge tone={project.status}>{project.status}</Badge>
          <span>{project.priority} priority</span>
          <span>
            {project.dueDate ? `Due ${project.dueDate}` : "No due date"}
          </span>
          <span>Updated {new Date(project.updated).toLocaleDateString()}</span>
        </div>
      </header>
      <div
        className="project-action-bar"
        role="group"
        aria-label="Project actions"
      >
        <button
          className="project-action project-action-primary"
          onClick={() => setModal("finding")}
        >
          <ShieldAlert size={14} />
          New finding
        </button>
        <button className="project-action" onClick={() => setModal("evidence")}>
          <Plus size={14} />
          Add evidence
        </button>
        <button className="project-action" onClick={() => setModal("note")}>
          <StickyNote size={14} />
          Research note
        </button>
        <span className="project-action-spacer" aria-hidden="true" />
        <button className="project-action" onClick={() => setModal("setup")}>
          <Pencil size={14} />
          Edit project
        </button>
        <CompleteProjectButton
          projectId={project.id}
          complete={project.status === "Complete"}
        />
      </div>
      <section className="my-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          [
            "Open findings",
            findings.filter((f) => f.status !== "Resolved").length,
          ],
          ["Evidence captured", evidence.length],
          ["Project progress", `${project.progress}%`],
          ["Research time", formatTime(totalSeconds)],
        ].map(([label, value]) => (
          <div key={label} className="panel">
            <p className="eyebrow">{label}</p>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="xl:col-span-2"><AIInsight key={project.id} request={{ kind: "project", projectId: project.id }} /></div>
        <section className="panel min-w-0">
          <div
            className="flex overflow-x-auto border-b border-[#303a40]"
            role="tablist"
            aria-label="Project records"
          >
            {tabs.map(([name, count]) => (
              <button
                key={name}
                role="tab"
                aria-selected={tab === name}
                id={`tab-${name.replace(/ /g, "-")}`}
                aria-controls="project-records"
                className={`shrink-0 border-b-2 px-3 py-3 text-xs font-semibold ${tab === name ? "border-[#b3d6c7] text-[#e2eee8]" : "border-transparent text-[#8a9aa4] hover:text-white"}`}
                onClick={() => {
                  setTab(name);
                  setQuery("");
                }}
              >
                {name}{" "}
                <span className="ml-1 text-[10px] opacity-60">{count}</span>
              </button>
            ))}
          </div>
          <div className="my-4 flex flex-wrap gap-3">
            <input
              className="field min-w-0 flex-1"
              aria-label={`Search ${tab.toLowerCase()}`}
              placeholder={`Search ${tab.toLowerCase()}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              className="button-secondary"
              onClick={() =>
                tab === "Time log"
                  ? document
                      .getElementById("focus-timer")
                      ?.scrollIntoView({ behavior: "smooth", block: "center" })
                  : setModal(activeCapture)
              }
            >
              <Plus size={14} />
              {tab === "Reports"
                ? "Create report"
                : tab === "Time log"
                  ? "Track time"
                  : `Add ${activeCapture}`}
            </button>
          </div>
          <div
            id="project-records"
            role="tabpanel"
            aria-labelledby={`tab-${tab.replace(/ /g, "-")}`}
            className="divide-y divide-[#29323a]"
          >
            {tab === "Findings" && (
              <>
                {findings
                  .filter((f) =>
                    matches(
                      `${f.title} ${f.description} ${f.severity} ${f.status}`,
                    ),
                  )
                  .map((f) => (
                    <article key={f.id} className="py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="break-words text-sm font-semibold">
                            {f.title}
                          </h3>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge tone={f.severity}>{f.severity}</Badge>
                            <Badge tone={f.status}>{f.status}</Badge>
                            <Badge>{f.category}</Badge>
                          </div>
                        </div>
                        <div className="flex">
                          <button
                            className="icon-button"
                            aria-label={`Edit ${f.title}`}
                            onClick={() => {
                              setEditingFinding(f);
                              setModal("finding");
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                          <DeleteButton
                            name={f.title}
                            action={() => deleteRecord("finding", f.id)}
                          />
                        </div>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#a0aeb7]">
                        {f.description || "No description added."}
                      </p>
                      <div className="mt-3">
                        <ActionForm
                          action={() =>
                            updateFindingStatus(
                              f.id,
                              f.status === "Open"
                                ? "In review"
                                : f.status === "In review"
                                  ? "Resolved"
                                  : "Open",
                            )
                          }
                          label={
                            f.status === "Open"
                              ? "Start review"
                              : f.status === "In review"
                                ? "Resolve finding"
                                : "Reopen finding"
                          }
                        >
                          {null}
                        </ActionForm>
                      </div>
                    </article>
                  ))}
                {!findings.some((f) =>
                  matches(
                    `${f.title} ${f.description} ${f.severity} ${f.status}`,
                  ),
                ) && (
                  <Empty>
                    {query
                      ? "No findings match this search."
                      : "Record a vulnerability, security issue, or positive observation."}
                  </Empty>
                )}
              </>
            )}
            {tab === "Evidence" && (
              <>
                {evidence
                  .filter((e) =>
                    matches(`${e.name} ${e.kind} ${e.description}`),
                  )
                  .map((e) => (
                    <article key={e.id} className="py-4">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="break-words text-sm font-semibold">
                            {e.name}
                          </h3>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge>{e.kind}</Badge>
                            <Badge>{e.category}</Badge>
                          </div>
                        </div>
                        <button
                          className="icon-button"
                          aria-label={`Edit ${e.name}`}
                          onClick={() => {
                            setEditingEvidence(e);
                            setModal("evidence");
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                        <DeleteButton
                          name={e.name}
                          action={() => deleteRecord("evidence", e.id)}
                        />
                      </div>
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#a0aeb7]">
                        {e.description || "No context added."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {e.sourceUrl && (
                          <a
                            className="button-secondary"
                            href={e.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink size={14} />
                            Open source
                          </a>
                        )}
                        {e.fileName && (
                          <a
                            className="button-secondary max-w-full"
                            href={`/api/evidence/${e.id}/download`}
                          >
                            <Download size={14} />
                            <span className="truncate">{e.fileName}</span>
                            <span className="shrink-0 text-[10px]">
                              {Math.ceil((e.fileSize || 0) / 1024)} KB
                            </span>
                          </a>
                        )}
                      </div>
                      {e.sha256 && (
                        <details className="mt-3 text-xs text-[#8a9aa4]">
                          <summary className="cursor-pointer">
                            File integrity (SHA-256)
                          </summary>
                          <code className="mt-2 block break-all">
                            {e.sha256}
                          </code>
                        </details>
                      )}
                    </article>
                  ))}
                {!evidence.some((e) =>
                  matches(`${e.name} ${e.kind} ${e.description}`),
                ) && (
                  <Empty>
                    {query
                      ? "No evidence matches this search."
                      : "Add an attachment, source link, or supporting context."}
                  </Empty>
                )}
              </>
            )}
            {tab === "Reports" && (
              <>
                {reports
                  .filter((r) => matches(r.name))
                  .map((r) => (
                    <article
                      key={r.id}
                      className="flex items-center gap-3 py-4"
                    >
                      <FileText size={20} className="shrink-0 text-[#a6c9bb]" />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/reports/${r.id}`}
                          className="text-sm font-semibold hover:text-[#bcdccc]"
                        >
                          {r.name}
                        </Link>
                        <p className="mt-1 text-xs text-[#89969e]">
                          Updated {new Date(r.updatedAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge tone={r.status}>{r.status}</Badge>
                      <Link
                        className="button-secondary"
                        href={`/reports/${r.id}`}
                      >
                        Open
                      </Link>
                      <DeleteButton
                        name={r.name}
                        action={() => deleteRecord("report", r.id)}
                      />
                    </article>
                  ))}
                {!reports.some((r) => matches(r.name)) && (
                  <Empty>
                    {query
                      ? "No reports match this search."
                      : "Create a draft from the findings and evidence in this project."}
                  </Empty>
                )}
              </>
            )}
            {tab === "Notes" && (
              <>
                {notes
                  .filter((n) => matches(`${n.title} ${n.content}`))
                  .map((n) => (
                    <article key={n.id} className="py-4">
                      <div className="flex items-center gap-2">
                        <h3 className="min-w-0 flex-1 break-words text-sm font-semibold">
                          {n.title}
                        </h3>
                        <button
                          className="icon-button"
                          aria-label={`Edit ${n.title}`}
                          onClick={() => {
                            setEditingNote(n);
                            setModal("note");
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                        <DeleteButton
                          name={n.title}
                          action={() => deleteRecord("note", n.id)}
                        />
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-[#a0aeb7]">
                        {n.content}
                      </p>
                      <p className="mt-3 text-[10px] text-[#89969e]">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </article>
                  ))}
                {!notes.some((n) => matches(`${n.title} ${n.content}`)) && (
                  <Empty>
                    {query
                      ? "No notes match this search."
                      : "Keep commands, hypotheses, and next steps close to your work."}
                  </Empty>
                )}
              </>
            )}
            {tab === "Time log" && (
              <>
                {timeEntries
                  .filter((t) => matches(t.description || "Research session"))
                  .map((t) => (
                    <article key={t.id} className="flex items-start gap-3 py-4">
                      <Timer size={18} className="mt-1 text-[#a6c9bb]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">
                          {formatTime(t.durationSeconds ?? t.minutes * 60)}
                        </p>
                        <p className="mt-1 break-words text-sm text-[#a0aeb7]">
                          {t.description || "Research session"}
                        </p>
                        <p className="mt-2 text-xs text-[#89969e]">
                          {t.recordedOn ? new Date(`${t.recordedOn}T12:00:00Z`).toLocaleDateString(undefined, { timeZone: "UTC" }) : new Date(t.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <DeleteButton
                        name="time entry"
                        action={() => deleteRecord("time", t.id)}
                      />
                    </article>
                  ))}
                {!timeEntries.some((t) =>
                  matches(t.description || "Research session"),
                ) && (
                  <Empty>
                    {query
                      ? "No sessions match this search."
                      : "Start the focus timer to track work on this project."}
                  </Empty>
                )}
              </>
            )}
            {tab === "Contacts" && (
              <>
                <p className="border-0 pb-4 text-xs leading-5 text-[#99a8b1]">
                  Keep a project contact list for reference. Adding a contact
                  does not send an invitation or grant account access.
                </p>
                {members
                  .filter((m) => matches(`${m.name} ${m.email} ${m.role}`))
                  .map((m) => (
                    <article
                      key={m.id}
                      className="flex items-center gap-3 py-4"
                    >
                      <Users size={18} className="text-[#a6c9bb]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{m.name}</p>
                        <p className="mt-1 break-all text-xs text-[#99a8b1]">
                          {m.email} · {m.role}
                        </p>
                      </div>
                      <DeleteButton
                        name={m.name}
                        label="Remove"
                        action={() => removeTeamMember(m.id, project.id)}
                      />
                    </article>
                  ))}
                {!members.some((m) =>
                  matches(`${m.name} ${m.email} ${m.role}`),
                ) && (
                  <Empty>
                    {query
                      ? "No contacts match this search."
                      : "Add the people involved in this assessment."}
                  </Empty>
                )}
              </>
            )}
          </div>
        </section>
        <aside className="project-sidebar">
          <ProjectTimer
            key={project.id}
            workspaceId={workspaceId}
            projectId={project.id}
            initial={timerSession}
          />
          <Panel title="Recent activity">
            {activities.length ? (
              activities.map((a) => (
                <div
                  className="border-b border-[#29323a] py-3 last:border-0"
                  key={a.id}
                >
                  <p
                    className="line-clamp-2 break-words text-xs leading-5 text-[#b7c2c9]"
                    title={a.message}
                  >
                    {a.message}
                  </p>
                  <p className="mt-1 text-[10px] text-[#89969e]">
                    {new Date(a.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <Empty>Activity appears as you work.</Empty>
            )}
            {activityPages > 1 && (
              <nav aria-label="Activity pages" className="activity-pagination">
                {activityPage > 1 ? (
                  <Link
                    scroll={false}
                    href={activityHref(activityPage - 1)}
                    className="button-secondary"
                  >
                    Newer
                  </Link>
                ) : (
                  <span />
                )}
                <span>
                  {activityPage} / {activityPages}
                </span>
                {activityPage < activityPages ? (
                  <Link
                    scroll={false}
                    href={activityHref(activityPage + 1)}
                    className="button-secondary"
                  >
                    Older
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </Panel>
        </aside>
      </div>
      {modal && (
        <Modal
          title={
            modal === "setup"
              ? "Edit project"
              : modal === "contact"
                ? "Add project contact"
                : modal === "report"
                  ? "Create report"
                  : `${editingFinding || editingEvidence || editingNote ? "Edit" : "New"} ${modal}`
          }
          onClose={close}
        >
          {modal === "finding" && (
            <FindingForm {...scope} record={editingFinding} />
          )}
          {modal === "evidence" && (
            <EvidenceForm {...scope} record={editingEvidence} />
          )}
          {modal === "note" && <NoteForm {...scope} record={editingNote} />}
          {modal === "report" && (
            <ActionForm
              action={createReport}
              label="Generate report"
              onSuccess={(data) => {
                close();
                router.push(`/reports/${(data as { id: string }).id}`);
              }}
            >
              <HiddenScope workspaceId={workspaceId} projectId={project.id} />
              <p className="text-xs leading-5 text-[#a1a1a1]">When AI is enabled, project text is shared with the configured AI provider to draft the narrative. Attachment files are excluded. If AI is unavailable, your report still includes all saved records.</p>
              <Field label="Report name">
                <input
                  name="name"
                  required
                  maxLength={200}
                  className="field"
                  defaultValue={`${project.name} assessment report`.slice(
                    0,
                    200,
                  )}
                />
              </Field>
              <p className="text-sm leading-6 text-[#99a8b1]">
                Automatically organize all findings, evidence, and research
                notes into a complete assessment, with an executive summary and
                prioritized next steps. Local AI adds a narrative when
                configured; your source records are always preserved.
              </p>
            </ActionForm>
          )}
          {modal === "contact" && (
            <ActionForm
              action={(form) =>
                addTeamMember(
                  project.id,
                  String(form.get("name")),
                  String(form.get("email")),
                  String(form.get("role")),
                )
              }
              label="Add contact"
              onSuccess={close}
            >
              <Field label="Name">
                <input name="name" required maxLength={200} className="field" />
              </Field>
              <Field label="Email">
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  className="field"
                />
              </Field>
              <Field label="Role">
                <input
                  name="role"
                  required
                  maxLength={80}
                  defaultValue="Contributor"
                  className="field"
                />
              </Field>
              <p className="text-xs text-[#99a8b1]">
                For project reference only. No invitation is sent.
              </p>
            </ActionForm>
          )}
          {modal === "setup" && (
            <ActionForm
              action={(form) =>
                updateProject(project.id, {
                  name: String(form.get("name")),
                  description: String(form.get("description")),
                  status: String(form.get("status")),
                  priority: String(form.get("priority")),
                  dueDate: String(form.get("dueDate")),
                  progress: Number(form.get("progress")),
                })
              }
              label="Save project"
              onSuccess={close}
            >
              <Field label="Project name">
                <input
                  name="name"
                  required
                  maxLength={200}
                  defaultValue={project.name}
                  className="field"
                />
              </Field>
              <Field label="Scope & description">
                <textarea
                  name="description"
                  maxLength={10000}
                  rows={5}
                  defaultValue={project.description}
                  className="field"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Status">
                  <select
                    name="status"
                    defaultValue={project.status}
                    className="field"
                  >
                    <option>Incomplete</option>
                    <option>Complete</option>
                  </select>
                </Field>
                <Field label="Priority">
                  <select
                    name="priority"
                    defaultValue={project.priority}
                    className="field"
                  >
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </Field>
                <Field label="Due date">
                  <input
                    name="dueDate"
                    type="date"
                    defaultValue={project.dueDate}
                    className="field"
                  />
                </Field>
                <Field label="Progress (%)">
                  <input
                    name="progress"
                    type="number"
                    min={0}
                    max={100}
                    required
                    defaultValue={project.progress}
                    className="field"
                  />
                </Field>
              </div>
              <p className="text-xs text-[#99a8b1]">
                Marking a project complete sets its progress to 100%.
              </p>
            </ActionForm>
          )}
        </Modal>
      )}
    </div>
  );
}
function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600),
    minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

