import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { aiConfiguration, requestOpenRouter } from "../../app/lib/openrouter";

// Opt-in only: spends one free request, sends synthetic data, never logs a key.
it.skipIf(process.env.SCOPELOG_LIVE_AI_TEST !== "1")(
  "connects to a free OpenRouter model with structured output",
  async () => {
    const { apiKey, model } = aiConfiguration();
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
    const originalFetch = globalThis.fetch;
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (...args) => {
        const response = await originalFetch(...args);
        const diagnostics = await response
          .clone()
          .json()
          .catch(() => ({}));
        console.log("Provider diagnostics", {
          status: response.status,
          model: diagnostics.model,
          finish: diagnostics.choices?.[0]?.finish_reason,
          contentLength: diagnostics.choices?.[0]?.message?.content?.length,
          errorCode: diagnostics.error?.code,
          errorMessage: String(diagnostics.error?.message || "")
            .replaceAll(apiKey, "[redacted]")
            .slice(0, 300),
        });
        return response;
      });
    const result = await requestOpenRouter({
      apiKey,
      model,
      input: '{"synthetic":true,"completedRooms":2,"savedMinutes":30}',
      instructions:
        "Write one short sentence in each field about these synthetic statistics. Suggest keeping notes next time.",
      fields: ["summary", "focus", "nextStep"],
    });
    spy.mockRestore();
    if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
    expect(result.value.summary).toBeTruthy();
    console.log(`Verified free structured generation with ${result.model}`);
  },
  60000,
);
