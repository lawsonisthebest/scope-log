import "server-only";
import { createHash } from "node:crypto";
import {
  aiConfiguration,
  AI_INPUT_LIMIT,
  isFreeModel,
  requestOpenRouter,
  validAIValue,
} from "./openrouter";
import type { AIJob, AIResult } from "./ai-types";
import { claimAI, pruneAI, reserveBucket, saveAI } from "./ai-store";

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const boundedLimit = (
  value: string | undefined,
  fallback: number,
  max: number,
) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0
    ? Math.min(number, max)
    : Math.min(fallback, max);
};

export async function generateAI(job: AIJob): Promise<AIResult> {
  const { apiKey, model } = aiConfiguration();
  if (!apiKey)
    return {
      ok: false,
      code: "unconfigured",
      message:
        "AI hasn't been enabled for this site yet. Your records and reports are still available.",
    };
  if (!isFreeModel(model))
    return {
      ok: false,
      code: "configuration",
      message: "The site owner needs to select a free OpenRouter model.",
    };
  const input = JSON.stringify(job.source);
  if (input.length > AI_INPUT_LIMIT)
    return {
      ok: false,
      code: "input",
      message:
        "These records exceed the AI input budget. Your original records are still available.",
    };
  const account = hash(apiKey).slice(0, 24);
  const id = hash(
    JSON.stringify([
      "v1",
      account,
      model,
      job.userId,
      job.projectId,
      job.feature,
      job.instructions,
      job.fields,
      input,
    ]),
  );
  try {
    const claim = await claimAI(id, job.userId, job.projectId);
    if (!claim.claimed) {
      if (
        claim.result &&
        (!claim.result.ok || validAIValue(claim.result.value, job.fields))
      ) {
        return claim.result.ok
          ? { ...claim.result, cached: true }
          : claim.result;
      }
      return {
        ok: false,
        code: "busy",
        message:
          "An insight for these records is already being prepared. Check again shortly.",
      };
    }
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const minute = now.toISOString().slice(0, 16);
    const tomorrow = new Date(`${day}T00:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const dailyLimit = boundedLimit(
      process.env.OPENROUTER_DAILY_LIMIT,
      50,
      1000,
    );
    const userLimit = boundedLimit(
      process.env.AI_USER_DAILY_LIMIT,
      20,
      dailyLimit,
    );
    // Atomic database counters coordinate all server instances. Rejected reservations
    // can consume earlier buckets conservatively; provider failures count as attempts.
    const permitted =
      (await reserveBucket(
        `${account}:user:${hash(job.userId)}:${day}`,
        userLimit,
        tomorrow,
      )) &&
      (await reserveBucket(`${account}:day:${day}`, dailyLimit, tomorrow)) &&
      (await reserveBucket(
        `${account}:minute:${minute}`,
        18,
        new Date(now.getTime() + 120000),
      ));
    const result: AIResult = permitted
      ? await requestOpenRouter({
          apiKey,
          model,
          input,
          instructions: job.instructions,
          fields: job.fields,
        })
      : {
          ok: false,
          code: "quota",
          message:
            "The shared or personal free AI limit has been reached. Try later; daily allowances reset at midnight UTC. Saved results remain available.",
        };
    await saveAI(id, job.userId, result);
    await pruneAI();
    return result;
  } catch {
    // Fail closed if quota storage is unavailable, without blocking the core app.
    return {
      ok: false,
      code: "unavailable",
      message:
        "AI is temporarily unavailable. Your records and reports are still available.",
    };
  }
}
