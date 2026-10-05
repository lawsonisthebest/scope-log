export type ReportSnapshot = {
  name: string;
  project: {
    projectName: string | null;
    description: string | null;
    status: string | null;
  };
  findings: {
    id: string;
    title: string;
    description: string | null;
    severity: string;
    status: string;
    category: string;
  }[];
  evidence: {
    id: string;
    name: string;
    description: string | null;
    kind: string;
    category: string;
    sourceUrl: string | null;
    fileName: string | null;
    fileSize: number | null;
    sha256: string | null;
  }[];
  notes: { id: string; title: string; content: string }[];
};
export type ReportNarrative = {
  summary: string;
  methodology: string;
  recommendations: string;
};
const severityOrder = ["Critical", "High", "Medium", "Low", "Informational"];
// Keep user text literal: captured commands/Markdown must not alter the report's structure.
function literal(value: string) {
  return value.replace(/([\\`*_{}\[\]<>()#+.!|~-])/g, "\\$1");
}
function body(value: string | null, missing: string) {
  return value?.trim() ? literal(value) : missing;
}

export function buildReport(
  snapshot: ReportSnapshot,
  narrative?: ReportNarrative,
  generatedAt = new Date(),
  aiStatus = "AI is not configured; generated from project records.",
) {
  const { project, findings, evidence, notes } = snapshot;
  const sorted = [...findings].sort(
    (a, b) =>
      severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity) ||
      a.id.localeCompare(b.id),
  );
  const unresolved = sorted.filter(
    (f) => f.status !== "Resolved" && f.category !== "Positive observation",
  );
  const urgent = unresolved.filter((f) =>
    ["Critical", "High"].includes(f.severity),
  );
  const references = (rows: typeof sorted) =>
    rows.map((f) => `F-${f.id}`).join(", ");
  const summary = `${findings.length} findings, ${evidence.length} evidence records, and ${notes.length} research notes were captured for this assessment. ${unresolved.length} findings remain unresolved, including ${urgent.length} rated High or Critical. ${findings.length ? "Recorded severities inform remediation priority; they do not establish business risk or test coverage." : "No recorded findings does not establish that the project is free of vulnerabilities."}`;
  const recommendations = unresolved.length
    ? `${urgent.length ? `1. Prioritize investigation and remediation of the High and Critical findings: ${references(urgent)}.\n` : ""}${urgent.length ? "2" : "1"}. Review remaining unresolved findings in severity order, assign owners, and agree target dates.\n${urgent.length ? "3" : "2"}. Verify each fix with a documented retest and retain supporting evidence before closing the finding.`
    : "Review the recorded scope and supporting material, confirm coverage, and verify any recorded resolutions before final sign-off.";
  const sections = [
    `# ${literal(snapshot.name)}\n\n**${literal(project.projectName || "Untitled project")}** · Security assessment\n\nPrepared ${generatedAt.toISOString().slice(0, 10)} (UTC) · Project status: ${literal(project.status || "Not recorded")}\n\n> Draft for review · Point-in-time snapshot\n>\n> ${narrative ? `${aiStatus.startsWith("AI-assisted") ? aiStatus : "AI-assisted narrative."} Verify the narrative against the source records before finalizing.` : aiStatus}`,
    "## Contents\n\n1. Executive summary\n2. Scope and methodology\n3. Findings overview\n4. Recommendations\n5. Detailed findings\n6. Evidence register\n7. Research notes",
    `## Executive summary\n\n${summary}${narrative ? `\n\n### Assessment narrative\n\n${literal(narrative.summary)}` : ""}`,
    `## Scope and methodology\n\n### Recorded scope\n\n${body(project.description, "No project scope was recorded.")}\n\n### Basis and limitations\n\nThis report compiles the project records available at generation time. Testing methods, authorization, affected targets, and reproduction steps are established only where explicitly documented in those records. Evidence attachments and linked pages are referenced, not automatically opened or analyzed. Research notes are working material, not independently verified findings.${narrative ? `\n\n### Recorded approach — AI synthesis\n\n${literal(narrative.methodology)}` : ""}`,
    `## Findings overview\n\n${severityOrder.map((severity) => `- **${severity}:** ${findings.filter((f) => f.severity === severity).length} findings`).join("\n")}\n\n${sorted.map((f) => `- **F-${f.id} · ${literal(f.title)}** — ${f.severity}; ${f.status}; ${f.category}`).join("\n") || "No findings recorded."}`,
    `## Recommendations\n\n${recommendations}${narrative ? `\n\n### Suggested next steps — AI synthesis\n\n${literal(narrative.recommendations)}` : ""}`,
    `## Detailed findings\n\n${sorted.map((f) => `### ${literal(f.title)}\n\n**Reference:** F-${f.id}\n\n**Severity:** ${f.severity} · **Status:** ${f.status} · **Category:** ${f.category}\n\n${body(f.description, "No technical description was recorded.")}`).join("\n\n---\n\n") || "No findings recorded at generation time."}`,
    `## Evidence register\n\n${evidence.map((e) => `### ${literal(e.name)}\n\n**Reference:** E-${e.id}\n\n**Type:** ${literal(e.kind)} · **Category:** ${literal(e.category)}\n\n${body(e.description, "No supporting context was recorded.")}${e.sourceUrl ? `\n\n**Source:** ${literal(e.sourceUrl)}` : ""}${e.fileName ? `\n\n**Attachment:** ${literal(e.fileName)}${e.fileSize !== null ? ` (${e.fileSize.toLocaleString("en-US")} bytes)` : ""}` : ""}${e.sha256 ? `\n\n**SHA-256:** ${e.sha256}` : ""}`).join("\n\n---\n\n") || "No evidence recorded at generation time."}`,
    `## Research notes\n\n${notes.map((n) => `### ${literal(n.title)}\n\n**Reference:** N-${n.id}\n\n${body(n.content, "No note content was recorded.")}`).join("\n\n---\n\n") || "No research notes recorded at generation time."}`,
  ];
  return sections.join("\n\n") + "\n";
}
