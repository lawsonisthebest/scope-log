// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const calls = vi.hoisted(() => ({
  createWorkspace: vi.fn(),
  renameWorkspace: vi.fn(),
  deleteWorkspace: vi.fn(),
  deleteRecord: vi.fn(),
  updateReport: vi.fn(),
}));
vi.mock("../../app/workspaces/actions", () => calls);
vi.mock("../../app/actions", () => calls);
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
import { WorkspaceManager } from "../../app/workspaces/workspace-manager";
import {
  Collection,
  type CollectionRow,
} from "../../app/components/collection";
import { ReportEditor } from "../../app/components/report-editor";
import { CommandSearch } from "../../app/components/command-search";
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function visual(name: string, html: string) {
  const dir = process.env.SCOPELOG_QA_DIR;
  if (dir) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `${name}.html`),
      `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/globals.css"></head><body><main class="page-container">${html}</main></body></html>`,
    );
  }
}
const workspaces = [
  {
    id: "lab",
    name: "Training labs",
    owner: "Researcher",
    createdAt: "2026-09-20",
    projectCount: 2,
    activeFindings: 1,
    progress: 50,
  },
];
const rows: CollectionRow[] = [
  {
    id: "finding",
    title: "Session validation",
    description: "Review session handling",
    workspace: "Labs",
    project: "Web security",
    href: "/workspaces/lab/projects/web?tab=Findings",
    category: "Vulnerability",
    status: "Open",
    severity: "High",
    updated: "2026-09-20T12:00:00Z",
  },
  {
    id: "other",
    title: "Resolved issue",
    description: "Fixed",
    workspace: "Client",
    project: "Portal",
    href: "/workspaces/client/projects/portal?tab=Findings",
    category: "Vulnerability",
    status: "Resolved",
    updated: "2026-09-20T12:00:00Z",
  },
];
describe("site controls audit", () => {
  it("searches, opens, creates, renames and confirms workspace deletion", async () => {
    for (const method of [
      calls.createWorkspace,
      calls.renameWorkspace,
      calls.deleteWorkspace,
    ])
      method.mockResolvedValue({ ok: true });
    const view = render(<WorkspaceManager initialWorkspaces={workspaces} />);
    visual("workspaces", view.container.innerHTML);
    expect(
      screen
        .getByRole("link", { name: "Open Training labs" })
        .getAttribute("href"),
    ).toBe("/workspaces/lab");
    await userEvent.type(screen.getByLabelText("Search workspaces"), "missing");
    expect(screen.getByText("No workspaces match this search.")).toBeTruthy();
    await userEvent.clear(screen.getByLabelText("Search workspaces"));
    await userEvent.click(
      screen.getByRole("button", { name: "New workspace" }),
    );
    await userEvent.type(screen.getByLabelText("Workspace name"), "New lab");
    await userEvent.click(
      screen.getByRole("button", { name: "Create workspace" }),
    );
    expect(calls.createWorkspace).toHaveBeenCalledWith("New lab");
    await userEvent.click(
      screen.getByRole("button", { name: "Rename Training labs" }),
    );
    await userEvent.clear(screen.getByLabelText("Workspace name"));
    await userEvent.type(
      screen.getByLabelText("Workspace name"),
      "Renamed lab",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save name" }));
    expect(calls.renameWorkspace).toHaveBeenCalledWith("lab", "Renamed lab");
    await userEvent.click(
      screen.getByRole("button", { name: "Delete Training labs" }),
    );
    expect(calls.deleteWorkspace).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(calls.deleteWorkspace).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Delete Training labs" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm delete" }),
    );
    expect(calls.deleteWorkspace).toHaveBeenCalledWith("lab");
  });
  it("filters collections and confirms a selected record's deletion", async () => {
    calls.deleteRecord.mockResolvedValue({ ok: true });
    const view = render(<Collection kind="finding" rows={rows} />);
    visual("findings", view.container.innerHTML);
    await userEvent.selectOptions(
      screen.getByLabelText("Filter by workspace"),
      "Labs",
    );
    expect(screen.queryByRole("link", { name: "Resolved issue" })).toBeNull();
    await userEvent.selectOptions(
      screen.getByLabelText("Filter by status or type"),
      "Resolved",
    );
    expect(screen.getByText("No records match these filters.")).toBeTruthy();
    await userEvent.selectOptions(
      screen.getByLabelText("Filter by status or type"),
      "All",
    );
    await userEvent.type(screen.getByLabelText("Search findings"), "session");
    expect(
      screen.getByRole("link", { name: "Session validation" }),
    ).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Delete Session validation" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm delete" }),
    );
    expect(calls.deleteRecord).toHaveBeenCalledWith("finding", "finding");
  });
  it("supports report edit, formatting, preview, save, download, and print controls", async () => {
    calls.updateReport.mockResolvedValue({ ok: true });
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const download = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => "blob:report-fixture");
    URL.revokeObjectURL = vi.fn();
    render(
      <ReportEditor
        report={{
          id: "report",
          name: "Assessment",
          content: "Plain content",
          status: "Draft",
          updatedAt: "2026-09-20",
        }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Print / PDF" }));
    expect(print).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const editor = screen.getByLabelText(
      "Report content",
    ) as HTMLTextAreaElement;
    editor.setSelectionRange(0, 5);
    await userEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(editor.value).toContain("**Plain**");
    for (const label of ["Heading", "List", "Code"])
      await userEvent.click(screen.getByRole("button", { name: label }));
    await userEvent.selectOptions(screen.getByLabelText("Status"), "In review");
    await userEvent.click(screen.getByRole("button", { name: "Save report" }));
    expect(calls.updateReport).toHaveBeenCalledWith(
      "report",
      "Assessment",
      expect.any(String),
      "In review",
    );
    await userEvent.click(screen.getByRole("button", { name: "Preview" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Export Markdown" }),
    );
    expect(download).toHaveBeenCalledOnce();
  });
  it("keeps report content after a failed save", async () => {
    calls.updateReport.mockRejectedValue(new Error("offline"));
    render(
      <ReportEditor
        report={{
          id: "report",
          name: "Assessment",
          content: "Original",
          status: "Draft",
          updatedAt: "2026-09-20",
        }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByLabelText("Report content"), " revised");
    await userEvent.click(screen.getByRole("button", { name: "Save report" }));
    expect(screen.getByRole("alert").textContent).toContain(
      "Connection interrupted",
    );
    expect(
      (screen.getByLabelText("Report content") as HTMLTextAreaElement).value,
    ).toContain("revised");
  });
  it("opens global search results and dismisses the dialog", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          {
            id: "finding",
            type: "Finding",
            title: "Session validation",
            href: rows[0].href,
          },
        ],
      })),
    );
    const close = vi.fn();
    render(<CommandSearch onClose={close} />);
    expect(
      within(screen.getByRole("dialog"))
        .getByRole("link", { name: "Progress" })
        .getAttribute("href"),
    ).toBe("/skills");
    await userEvent.type(
      screen.getByLabelText("Search your research"),
      "session",
    );
    const result = await screen.findByRole("link", {
      name: /Session validation/,
    });
    expect(result.getAttribute("href")).toBe(rows[0].href);
    await userEvent.click(result);
    expect(close).toHaveBeenCalledOnce();
  });
});
