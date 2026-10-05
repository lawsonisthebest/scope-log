import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../../app/lib/ai-store", () => ({
  claimAI: vi.fn(),
  saveAI: vi.fn(),
  reserveBucket: vi.fn(),
  pruneAI: vi.fn(),
}));
import {
  claimAI,
  saveAI,
  reserveBucket,
  pruneAI,
} from "../../app/lib/ai-store";
import { generateAI } from "../../app/lib/ai-service";
import type { AIJob } from "../../app/lib/ai-types";

const value = { summary: "Facts", focus: "Gap", nextStep: "Action" };
const job: AIJob = {
  userId: "owner",
  feature: "overview",
  source: { total: 1 },
  instructions: "Summarize",
  fields: Object.keys(value),
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENROUTER_API_KEY", "fake-key");
  vi.stubEnv("OPENROUTER_MODEL", "openrouter/free");
  vi.stubEnv("OPENROUTER_DAILY_LIMIT", "50");
  vi.stubEnv("AI_USER_DAILY_LIMIT", "20");
  vi.mocked(claimAI).mockResolvedValue({ claimed: true });
  vi.mocked(reserveBucket).mockResolvedValue(true);
  vi.mocked(saveAI).mockResolvedValue(undefined);
  vi.mocked(pruneAI).mockResolvedValue(undefined);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: { content: JSON.stringify(value) },
              },
            ],
          }),
        ),
      ),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AI cache and allowances", () => {
  it("does nothing externally until a key is configured", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(await generateAI(job)).toMatchObject({
      ok: false,
      code: "unconfigured",
    });
    expect(claimAI).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("reuses valid saved results even when the generation quota is exhausted", async () => {
    vi.mocked(claimAI).mockResolvedValue({
      claimed: false,
      result: {
        ok: true,
        value,
        model: "free",
        generatedAt: "2026-10-03T00:00:00Z",
      },
    });
    expect(await generateAI(job)).toMatchObject({
      ok: true,
      cached: true,
      value,
    });
    expect(reserveBucket).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("coalesces requests while the same snapshot is generating", async () => {
    vi.mocked(claimAI).mockResolvedValue({ claimed: false, result: null });
    expect(await generateAI(job)).toMatchObject({ ok: false, code: "busy" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not call the provider after a rejected reservation", async () => {
    vi.mocked(reserveBucket).mockResolvedValue(false);
    expect(await generateAI(job)).toMatchObject({ ok: false, code: "quota" });
    expect(fetch).not.toHaveBeenCalled();
    expect(saveAI).toHaveBeenCalled();
  });
  it("isolates cache entries by user, feature, and changed records", async () => {
    vi.mocked(claimAI).mockResolvedValue({ claimed: false, result: null });
    for (const variation of [
      job,
      { ...job, userId: "other" },
      { ...job, feature: "project" as const },
      { ...job, source: { total: 2 } },
    ])
      await generateAI(variation);
    expect(
      new Set(vi.mocked(claimAI).mock.calls.map(([key]) => key)).size,
    ).toBe(4);
  });
  it("bounds configured allowances and stores only validated results", async () => {
    vi.stubEnv("OPENROUTER_DAILY_LIMIT", "9000");
    vi.stubEnv("AI_USER_DAILY_LIMIT", "9000");
    expect(await generateAI(job)).toMatchObject({ ok: true, value });
    expect(vi.mocked(reserveBucket).mock.calls.map((call) => call[1])).toEqual([
      1000, 1000, 18,
    ]);
    expect(saveAI).toHaveBeenCalledWith(
      expect.any(String),
      "owner",
      expect.objectContaining({ ok: true, value }),
    );
  });
  it("fails closed when quota storage is unavailable", async () => {
    vi.mocked(claimAI).mockRejectedValue(new Error("DB offline"));
    expect(await generateAI(job)).toMatchObject({
      ok: false,
      code: "unavailable",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
