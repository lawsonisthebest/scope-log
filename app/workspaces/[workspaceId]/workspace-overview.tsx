"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import { createProject, deleteProject } from "../actions";
import {
  ActionForm,
  Badge,
  DeleteButton,
  Empty,
  Field,
  Modal,
  Panel,
} from "@/app/components/ui";
type Project = {
  id: string;
  name: string;
  status: string;
  progress: number;
  priority: string;
  description: string;
  dueDate: string;
};
export function WorkspaceOverview({
  workspaceId,
  workspaceName,
  owner,
  initialProjects: projects,
  activities,
}: {
  workspaceId: string;
  workspaceName: string;
  owner: string;
  initialProjects: Project[];
  activities: { id: string; message: string; createdAt: string }[];
}) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All"),
    [creating, setCreating] = useState(false);
  const visible = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "All" || p.status === filter),
  );
  const [now] = useState(() => Date.now());
  const today = new Date(now).toISOString().slice(0, 10),
    upcoming = new Date(now + 7 * 86400000).toISOString().slice(0, 10);
  return (
    <div className="page workspace-detail">
      <Link
        href="/workspaces"
        className="text-xs text-[var(--muted)] hover:text-white"
      >
        ← All workspaces
      </Link>
      <header className="page-header mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Workspace overview</p>
          <h1 className="break-words">{workspaceName}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Owned by {owner}</p>
        </div>
        <button className="button" onClick={() => setCreating(true)}>
          <Plus size={15} />
          New project
        </button>
      </header>
      <div className="my-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          ["Total projects", projects.length],
          [
            "Active projects",
            projects.filter((p) => p.status !== "Complete").length,
          ],
          [
            "Average progress",
            `${projects.length ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length) : 0}%`,
          ],
          [
            "Due in 7 days",
            projects.filter(
              (p) =>
                p.status !== "Complete" &&
                p.dueDate >= today &&
                p.dueDate <= upcoming,
            ).length,
          ],
        ].map(([label, value]) => (
          <div className="panel" key={label}>
            <p className="eyebrow">{label}</p>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="Projects">
          <div className="mb-4 flex flex-wrap gap-3">
            <label className="search-field flex-1">
              <Search size={15} aria-hidden="true" />
              <input
                aria-label="Search projects"
                placeholder="Search projects…"
                className="field"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select
              aria-label="Filter projects by status"
              className="field w-auto"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option>All</option>
              <option>Incomplete</option>
              <option>Complete</option>
            </select>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {visible.map((p) => (
              <article
                className="flex flex-wrap items-center gap-4 py-5"
                key={p.id}
              >
                <div className="min-w-[150px] flex-1">
                  <Link
                    href={`/workspaces/${workspaceId}/projects/${p.id}`}
                    className="text-sm font-semibold hover:text-[var(--signal)]"
                  >
                    {p.name}
                  </Link>
                  <p className="mt-1 line-clamp-1 text-xs text-[var(--muted)]">
                    {p.description || "Security assessment"}
                  </p>
                  <p
                    className={`mt-2 text-xs ${p.dueDate && p.dueDate < today && p.status !== "Complete" ? "text-[#e6a3af]" : "text-[var(--muted)]"}`}
                  >
                    {p.dueDate ? `Due ${p.dueDate}` : "No due date"} ·{" "}
                    {p.priority} priority
                  </p>
                </div>
                <Badge tone={p.status}>{p.status}</Badge>
                <div className="w-24">
                  <p className="mb-2 text-right text-xs text-[var(--muted)]">
                    {p.progress}%
                  </p>
                  <div className="h-1.5 rounded-full bg-[var(--line)]">
                    <div
                      className="h-full rounded-full bg-[var(--signal)]"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                </div>
                <Link
                  className="icon-button"
                  aria-label={`Open ${p.name}`}
                  href={`/workspaces/${workspaceId}/projects/${p.id}`}
                >
                  <ArrowUpRight size={17} />
                </Link>
                <DeleteButton
                  name={p.name}
                  action={() => deleteProject(p.id)}
                  description="This permanently deletes the project and all its findings, evidence, reports, notes, time entries, and contacts."
                />
              </article>
            ))}
          </div>
          {!visible.length && (
            <Empty>
              {projects.length
                ? "No projects match these filters."
                : "Create a project to define your scope and start recording research."}
            </Empty>
          )}
        </Panel>
        <Panel title="Recent activity">
          {activities.length ? (
            activities.map((a) => (
              <div
                key={a.id}
                className="border-b border-[var(--line)] py-3 last:border-0"
              >
                <p className="text-xs leading-5 text-[var(--ink)]">
                  {a.message}
                </p>
                <p className="mt-1 text-[10px] text-[var(--muted)]">
                  {new Date(a.createdAt).toLocaleString()}
                </p>
              </div>
            ))
          ) : (
            <Empty>Activity appears as you work.</Empty>
          )}
        </Panel>
      </div>
      {creating && (
        <Modal
          title="New project"
          description="Start with a name. Add scope, due dates, and priorities inside the project."
          onClose={() => setCreating(false)}
        >
          <ActionForm
            action={(form) =>
              createProject(workspaceId, String(form.get("name")))
            }
            label="Create project"
            onSuccess={() => setCreating(false)}
          >
            <Field label="Project name">
              <input
                name="name"
                required
                maxLength={200}
                autoFocus
                className="field"
                placeholder="e.g. Customer portal assessment"
              />
            </Field>
          </ActionForm>
        </Modal>
      )}
    </div>
  );
}
