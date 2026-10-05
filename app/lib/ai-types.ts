export type InsightRequest =
  | { kind: "overview" }
  | { kind: "project"; projectId: string }
  | { kind: "progress"; month: string; timeZone: string };

export type AIResult =
  | {
      ok: true;
      value: Record<string, string>;
      model: string;
      generatedAt: string;
      cached?: boolean;
    }
  | { ok: false; message: string; code: string };

export type AIJob = {
  userId: string;
  projectId?: string;
  feature: "report" | InsightRequest["kind"];
  source: unknown;
  instructions: string;
  fields: readonly string[];
};
