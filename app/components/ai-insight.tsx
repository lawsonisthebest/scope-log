"use client";

import { useId, useState, useTransition } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import { generateInsight } from "../ai-actions";
import type { AIResult, InsightRequest } from "../lib/ai-types";

export function AIInsight({ request }: { request: InsightRequest }) {
  const headingId = useId();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AIResult | null>(null);
  const [saved, setSaved] = useState<Extract<AIResult, { ok: true }> | null>(
    null,
  );
  const title =
    request.kind === "project"
      ? "A useful next step"
      : request.kind === "progress"
        ? "Your month in perspective"
        : "Where to focus";
  const description =
    request.kind === "project"
      ? "Turn your scope, findings, evidence, and notes into a practical next action."
      : request.kind === "progress"
        ? "Review the selected month’s saved time and completions. Live timers aren’t included."
        : "Find a starting point from your project stats and unresolved findings.";
  function generate() {
    startTransition(async () => {
      try {
        const next = await generateInsight(request);
        setResult(next);
        if (next.ok) setSaved(next);
      } catch {
        setResult({
          ok: false,
          code: "network",
          message: "Connection interrupted. Please try again.",
        });
      }
    });
  }
  return (
    <section
      className="ai-insight"
      aria-labelledby={headingId}
      aria-busy={pending}
    >
      <div className="ai-insight-header">
        <div>
          <p className="ai-insight-kicker">
            <Sparkles size={13} aria-hidden="true" /> AI insights
          </p>
          <h2 id={headingId}>{title}</h2>
          <p className="ai-insight-description">{description}</p>
        </div>
        <button
          type="button"
          className="button-secondary"
          disabled={pending}
          onClick={generate}
        >
          {pending ? (
            <LoaderCircle
              size={14}
              className="animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Sparkles size={14} aria-hidden="true" />
          )}
          {pending
            ? "Preparing insight…"
            : saved
              ? "Check for updates"
              : "Generate insight"}
        </button>
      </div>
      <div aria-live="polite">
        {saved && (
          <>
            <div className="ai-insight-grid">
              {[
                ["summary", "The picture"],
                ["focus", "Worth your attention"],
                ["nextStep", "Try this next"],
              ].map(([field, label]) => (
                <div key={field}>
                  <h3>{label}</h3>
                  <p>{saved.value[field]}</p>
                </div>
              ))}
            </div>
            <p className="ai-insight-footnote">
              AI suggestions · Review against your records · Snapshot from{" "}
              {new Date(saved.generatedAt).toLocaleString()}
              {result?.ok && result.cached ? " · Reused saved result" : ""}
            </p>
          </>
        )}
        {result && !result.ok && (
          <p className="ai-insight-message" role="status">
            {result.message}
          </p>
        )}
      </div>
      <p className="ai-insight-footnote">
        Generated on request using OpenRouter.{" "}
        {request.kind === "project"
          ? "Project text is shared; attachment files are excluded."
          : "A summary of this view is shared."}{" "}
        Unchanged results are reused for up to 24 hours to conserve the shared
        free allowance.
      </p>
    </section>
  );
}
