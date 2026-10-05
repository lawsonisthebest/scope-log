// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
const refresh = vi.hoisted(() => vi.fn());
const router = { refresh };
vi.mock("../../app/ai-actions", () => ({ generateInsight: vi.fn() }));
vi.mock("../../app/actions", () => ({
  deleteRecord: vi.fn(async () => ({ ok: true })),
}));
vi.mock("../../app/skills/corrections", () => ({
  correctCompletion: vi.fn(async () => ({
    ok: true,
    data: { date: "2026-09-15" },
  })),
  correctTime: vi.fn(async () => ({ ok: true, data: { date: "2026-09-15" } })),
  removeCompletion: vi.fn(async () => ({ ok: true })),
}));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => router }));
import { ProgressDashboard } from "../../app/skills/progress-dashboard";
import type { AutomaticProgress } from "../../app/lib/progress";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
const data: AutomaticProgress = {
  rooms: [
    {
      id: "one",
      workspaceId: "workspace",
      name: "SQL labs",
      status: "Complete",
      completedAt: "2026-09-28T18:00:00Z",
    },
    {
      id: "two",
      workspaceId: "workspace",
      name: "Reading room",
      status: "Incomplete",
      completedAt: null,
    },
  ],
  time: [
    {
      id: "session",
      projectId: "two",
      workspaceId: "workspace",
      description: "Reading session",
      createdAt: "2026-09-27T18:00:00Z",
      seconds: 1200,
      intervals: [],
    },
  ],
  timers: [],
};
function show() {
  render(<ProgressDashboard now="2026-09-29T12:00:00Z" data={data} />);
}
describe("automatic progress dashboard", () => {
  it("shows completions and time without manual controls, supports date drilldown and charts", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-29T12:00:00Z"));
    show();
    expect(screen.queryByRole("button", { name: "Log progress" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Your skills" })).toBeNull();
    await userEvent.click(
      screen.getByRole("button", {
        name: "September 28: 1 rooms completed, 0m",
      }),
    );
    expect(screen.getByRole("heading", { name: "SQL labs" })).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Reading session" }),
    ).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Show full month" }),
    );
    expect(
      screen.getByRole("heading", { name: "Reading session" }),
    ).toBeTruthy();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Chart metric" }),
      "minutes",
    );
    expect(
      screen.getByRole("button", { name: "2026-09-27: 20m" }),
    ).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Previous month" }),
    );
    expect(screen.getByRole("heading", { name: "August 2026" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "SQL labs" })).toBeNull();
  });
  it("refreshes automatically and recomputes the local day while left open", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-29T12:00:00Z"));
    show();
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });
    expect(refresh).toHaveBeenCalled();
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("heading", { name: "October 2026" })).toBeTruthy();
  });
});

it("lets users correct a completion date without adding a manual progress log", async () => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-29T12:00:00Z"));
  const { correctCompletion } = await import("../../app/skills/corrections");
  show();
  await userEvent.click(
    screen.getByRole("button", { name: "Edit completion SQL labs" }),
  );
  const field = screen.getByLabelText("Completion date");
  await userEvent.clear(field);
  await userEvent.type(field, "2026-09-15");
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(correctCompletion).toHaveBeenCalledOnce();
  const form = vi.mocked(correctCompletion).mock.calls[0][0];
  expect(form.get("date")).toBe("2026-09-15");
  expect(form.get("projectId")).toBe("one");
});
