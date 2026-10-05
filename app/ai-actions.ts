"use server";

import { session } from "./lib/action-utils";
import { insightContext } from "./lib/ai-context";
import { generateAI } from "./lib/ai-service";
import type { AIResult, InsightRequest } from "./lib/ai-types";
import { ValidationError } from "./lib/validation";

export async function generateInsight(
  request: InsightRequest,
): Promise<AIResult> {
  try {
    const userId = await session();
    // Resolve all facts and ownership on the server. Clients only choose the view.
    const context = await insightContext(request, userId);
    return await generateAI({
      ...context,
      userId,
      feature: request.kind,
      fields: ["summary", "focus", "nextStep"],
    });
  } catch (error) {
    return {
      ok: false,
      code: "request",
      message:
        error instanceof ValidationError
          ? error.message
          : "We couldn't prepare this insight. Please try again later.",
    };
  }
}
