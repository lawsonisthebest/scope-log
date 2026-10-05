// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../app/ai-actions", () => ({ generateInsight: vi.fn() }));
import { generateInsight } from "../../app/ai-actions";
import { AIInsight } from "../../app/components/ai-insight";
import type { AIResult } from "../../app/lib/ai-types";

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const success: AIResult = {
  ok: true,
  value: {
    summary: "Two rooms complete",
    focus: "Recorded activity",
    nextStep: "Document the next session",
  },
  model: "free",
  generatedAt: "2026-10-03T12:00:00Z",
};
describe("on-demand insight cards", () => {
  it("does not spend quota on render and sends the selected month only on request", async () => {
    vi.mocked(generateInsight).mockResolvedValue(success);
    const request = {
      kind: "progress" as const,
      month: "2026-09",
      timeZone: "America/Denver",
    };
    render(<AIInsight request={request} />);
    expect(generateInsight).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Generate insight" }),
    );
    expect(generateInsight).toHaveBeenCalledWith(request);
    expect(await screen.findByText("Two rooms complete")).toBeTruthy();
  });
  it("shows progress and blocks duplicate clicks while pending", async () => {
    let complete!: (result: AIResult) => void;
    vi.mocked(generateInsight).mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    render(<AIInsight request={{ kind: "overview" }} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Generate insight" }),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Preparing insight…",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await act(async () => complete(success));
  });
  it("keeps a saved insight visible when checking again fails", async () => {
    vi.mocked(generateInsight)
      .mockResolvedValueOnce(success)
      .mockResolvedValueOnce({
        ok: false,
        code: "quota",
        message: "Shared free limit reached.",
      });
    render(<AIInsight request={{ kind: "project", projectId: "example" }} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Generate insight" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Check for updates" }),
    );
    expect(await screen.findByText("Shared free limit reached.")).toBeTruthy();
    expect(screen.getByText("Two rooms complete")).toBeTruthy();
  });
  it("renders provider text without interpreting HTML", async () => {
    vi.mocked(generateInsight).mockResolvedValue({
      ...success,
      value: { ...success.value, summary: "<script>alert(1)</script>" },
    });
    const { container } = render(<AIInsight request={{ kind: "overview" }} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Generate insight" }),
    );
    expect(await screen.findByText("<script>alert(1)</script>")).toBeTruthy();
    expect(container.querySelector("script")).toBeNull();
  });
});
