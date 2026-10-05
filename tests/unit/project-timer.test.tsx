// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const actions = vi.hoisted(() => ({
  logTime: vi.fn(),
  startTimer: vi.fn(),
  pauseTimer: vi.fn(),
  resumeTimer: vi.fn(),
  stopTimer: vi.fn(),
  completeProject: vi.fn(),
}));
vi.mock("@/app/actions", () => actions);
vi.mock("@/app/workspaces/actions", () => ({
  completeProject: actions.completeProject,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import {
  CompleteProjectButton,
  ProjectTimer,
} from "../../app/workspaces/[workspaceId]/projects/[projectId]/project-controls";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("saves manual minutes with the project scope", async () => {
  actions.logTime.mockResolvedValue({ ok: true, data: undefined });
  const user = userEvent.setup();
  render(
    <ProjectTimer workspaceId="workspace" projectId="project" initial={null} />,
  );
  await user.type(screen.getByLabelText("Minutes spent"), "45");
  await user.type(screen.getByLabelText("Session note (optional)"), "Review");
  await user.click(screen.getByRole("button", { name: "Save time" }));
  await waitFor(() => expect(actions.logTime).toHaveBeenCalledOnce());
  const form = actions.logTime.mock.calls[0][0];
  expect(form.get("minutes")).toBe("45");
  expect(form.get("projectId")).toBe("project");
  expect(form.get("description")).toBe("Review");
});
it("keeps a live session while switching modes and saves on stop", async () => {
  actions.stopTimer.mockResolvedValue({ ok: true, data: { seconds: 120 } });
  const user = userEvent.setup();
  render(
    <ProjectTimer
      workspaceId="workspace"
      projectId="project"
      initial={{
        id: "timer",
        status: "running",
        elapsedSeconds: 120,
        startedAt: new Date().toISOString(),
        description: "Research",
      }}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Log time" }));
  expect(
    screen.getByRole("button", { name: /Timer still running/ }),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Run timer" }));
  await user.click(screen.getByRole("button", { name: /Stop & save/ }));
  await waitFor(() =>
    expect(actions.stopTimer).toHaveBeenCalledWith("timer", "Research"),
  );
  expect(
    await screen.findByRole("button", { name: "Start timer" }),
  ).toBeTruthy();
});
it("keeps controls usable after a network failure", async () => {
  actions.startTimer.mockRejectedValue(new Error("offline"));
  const user = userEvent.setup();
  render(
    <ProjectTimer workspaceId="workspace" projectId="project" initial={null} />,
  );
  await user.click(screen.getByRole("button", { name: "Run timer" }));
  await user.click(screen.getByRole("button", { name: "Start timer" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Connection interrupted",
  );
});

it("recovers the completion button after a network failure", async () => {
  actions.completeProject.mockRejectedValue(new Error("offline"));
  render(<CompleteProjectButton projectId="room" complete={false} />);
  await userEvent.click(
    screen.getByRole("button", { name: "Complete project" }),
  );
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Connection interrupted",
  );
  expect(
    (
      screen.getByRole("button", {
        name: "Complete project",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
});
