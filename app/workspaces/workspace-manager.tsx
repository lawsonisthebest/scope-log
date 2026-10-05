"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FolderKanban, Pencil, Plus, Search } from "lucide-react";
import { createWorkspace, deleteWorkspace, renameWorkspace } from "./actions";
import {
  ActionForm,
  DeleteButton,
  Empty,
  Field,
  Modal,
} from "../components/ui";

export type Workspace = {
  id: string;
  name: string;
  owner: string;
  createdAt: string;
  projectCount: number;
  activeFindings: number;
  progress: number;
};
export function WorkspaceManager({
  initialWorkspaces,
}: {
  initialWorkspaces: Workspace[];
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Workspace | "new" | null>(null);
  const visible = initialWorkspaces.filter((workspace) =>
    `${workspace.name} ${workspace.owner}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const projectCount = initialWorkspaces.reduce(
    (sum, workspace) => sum + workspace.projectCount,
    0,
  );
  return (
    <div className="page workspace-page">
      <header className="page-header workspace-page-header">
        <div>
          <p className="eyebrow">Your research, organized</p>
          <h1>Workspaces</h1>
          <p>A home for every engagement, lab, and investigation.</p>
        </div>
        <button className="button" onClick={() => setEditing("new")}>
          <Plus size={15} />
          New workspace
        </button>
      </header>
      <section className="workspace-summary" aria-label="Workspace summary">
        {[
          ["Workspaces", initialWorkspaces.length, "Organized research areas"],
          ["Projects", projectCount, "Across all workspaces"],
          [
            "Open findings",
            initialWorkspaces.reduce(
              (sum, workspace) => sum + workspace.activeFindings,
              0,
            ),
            "Observations to follow up",
          ],
        ].map(([label, value, detail]) => (
          <div className="panel workspace-summary-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <p>{detail}</p>
          </div>
        ))}
      </section>
      <section className="board workspace-board">
        <div className="board-title">
          <div>
            <h2>All workspaces</h2>
            <p>
              {visible.length} of {initialWorkspaces.length} workspaces
            </p>
          </div>
          <label className="search-field workspace-search">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Search workspaces"
              placeholder="Search workspaces…"
              className="field"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        <div className="workspace-grid">
          {visible.map((workspace) => (
            <article key={workspace.id} className="workspace-row">
              <Link
                className="workspace-identity"
                href={`/workspaces/${workspace.id}`}
              >
                <span className="workspace-card-icon">
                  <FolderKanban size={20} />
                </span>
                <div>
                  <h3>{workspace.name}</h3>
                  <p>{workspace.owner}</p>
                </div>
              </Link>
              <div className="workspace-row-count">
                <strong>{workspace.projectCount}</strong>
                <span>Projects</span>
              </div>
              <div className="workspace-row-count">
                <strong>{workspace.activeFindings}</strong>
                <span>Open findings</span>
              </div>
              <div className="workspace-row-progress">
                <div className="workspace-card-progress">
                  <span>Progress</span>
                  <strong>{workspace.progress}%</strong>
                </div>
                <div
                  className="workspace-progress-track"
                  role="progressbar"
                  aria-label={`${workspace.name} average progress`}
                  aria-valuenow={workspace.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${workspace.progress}%` }} />
                </div>
              </div>
              <div className="workspace-row-actions">
                <button
                  className="icon-button"
                  aria-label={`Rename ${workspace.name}`}
                  onClick={() => setEditing(workspace)}
                >
                  <Pencil size={14} />
                </button>
                <DeleteButton
                  name={workspace.name}
                  action={() => deleteWorkspace(workspace.id)}
                  description="This permanently deletes the workspace and all its projects, findings, evidence, reports, notes, time entries, and contacts."
                />
                <Link
                  className="button-secondary"
                  href={`/workspaces/${workspace.id}`}
                  aria-label={`Open ${workspace.name}`}
                >
                  Open
                  <ArrowUpRight size={14} />
                </Link>
              </div>
            </article>
          ))}
        </div>
        {!visible.length && (
          <Empty>
            {query
              ? "No workspaces match this search."
              : "Create your first workspace to bring your projects and research together."}
          </Empty>
        )}
      </section>
      {editing && (
        <Modal
          title={editing === "new" ? "New workspace" : "Rename workspace"}
          description="Use a client, engagement, or research area as the workspace name."
          onClose={() => setEditing(null)}
        >
          <ActionForm
            action={(form) =>
              editing === "new"
                ? createWorkspace(String(form.get("name")))
                : renameWorkspace(editing.id, String(form.get("name")))
            }
            label={editing === "new" ? "Create workspace" : "Save name"}
            onSuccess={() => setEditing(null)}
          >
            <Field label="Workspace name">
              <input
                name="name"
                required
                maxLength={200}
                className="field"
                placeholder="e.g. Acme security assessments"
                defaultValue={editing === "new" ? "" : editing.name}
                autoFocus
              />
            </Field>
          </ActionForm>
        </Modal>
      )}
    </div>
  );
}
