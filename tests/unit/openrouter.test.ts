import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { isFreeModel, requestOpenRouter } from "../../app/lib/openrouter";

const value = {
  summary: "Recorded work",
  focus: "Document coverage",
  nextStep: "Review the scope",
};
const job = {
  apiKey: "test-key",
  model: "openrouter/free",
  input: "untrusted source text",
  instructions: "Use recorded facts.",
  fields: Object.keys(value),
};
const completion = (
  content: unknown = JSON.stringify(value),
  finish = "stop",
) =>
  new Response(
    JSON.stringify({
      model: "example/model:free",
      choices: [{ finish_reason: finish, message: { content } }],
    }),
  );
afterEach(() => vi.unstubAllGlobals());

describe("free OpenRouter transport", () => {
  it("uses structured outputs, a server key, zero prices, and no paid fallback", async () => {
    const fetcher = vi.fn().mockResolvedValue(completion());
    vi.stubGlobal("fetch", fetcher);
    const result = await requestOpenRouter(job);
    expect(result).toMatchObject({
      ok: true,
      value,
      model: "example/model:free",
    });
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(options.headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(options.body);
    expect(body.provider.max_price).toEqual({ prompt: 0, completion: 0 });
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.messages[0].content).toContain("untrusted data");
    expect(body.messages[1].content).toContain(job.input);
    expect(body).not.toHaveProperty("models");
    expect(body).not.toHaveProperty("plugins");
  });
  it.each([
    "openrouter/auto",
    "openrouter/auto:free",
    "example/paid",
    "https://evil.invalid",
    "example/model:free,paid/model",
  ])("rejects unsupported model %s before a request", async (model) => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(isFreeModel(model)).toBe(false);
    expect(await requestOpenRouter({ ...job, model })).toMatchObject({
      ok: false,
      code: "configuration",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects oversized input without silently truncating it", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(
      await requestOpenRouter({ ...job, input: "x".repeat(40001) }),
    ).toMatchObject({ ok: false, code: "input" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([429, 401, 402, 403, 503])(
    "handles HTTP %s without retries or exposing provider errors",
    async (status) => {
      const fetcher = vi
        .fn()
        .mockResolvedValue(
          new Response("sensitive provider error", { status }),
        );
      vi.stubGlobal("fetch", fetcher);
      const result = await requestOpenRouter(job);
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain("sensitive");
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    ["not JSON", "stop"],
    [JSON.stringify(value), "length"],
    [JSON.stringify({ ...value, summary: "" }), "stop"],
    [JSON.stringify({ ...value, summary: "x".repeat(6001) }), "stop"],
    [JSON.stringify({ summary: "Partial" }), "stop"],
    [null, "stop"],
    [JSON.stringify({ ...value, extra: "unexpected" }), "stop"],
  ])("rejects incomplete or invalid output", async (content, finish) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(completion(content, finish as string)),
    );
    expect(await requestOpenRouter(job)).toMatchObject({
      ok: false,
      code: "unavailable",
    });
  });
  it("handles network failure or timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")),
    );
    expect(await requestOpenRouter(job)).toMatchObject({
      ok: false,
      code: "unavailable",
    });
  });
});
