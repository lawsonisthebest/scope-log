import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildReport, type ReportSnapshot } from "../../app/lib/report-generation";
import { generateNarrative } from "../../app/lib/report-ai";

const snapshot: ReportSnapshot = {
  name: "Assessment report", project: { projectName: "Example", description: "Authorized scope", status: "Incomplete" },
  findings: [
    { id: "low", title: "Minor issue", description: "Full reproduction details", severity: "Low", status: "Open", category: "Vulnerability" },
    { id: "high", title: "Access control", description: "Restricted endpoint", severity: "High", status: "In review", category: "Security issue" },
    { id: "positive", title: "Good controls", description: "Observation", severity: "High", status: "Open", category: "Positive observation" },
  ],
  evidence: [{ id: "evidence", name: "Response log", description: "Supporting context", kind: "Log", category: "Supporting evidence", sourceUrl: "https://example.com", fileName: "response.txt", fileSize: 50, sha256: "abc123" }],
  notes: [{ id: "note", title: "Research hypotheses", content: "Unverified hypothesis\nA second line" }],
};
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("complete report generation", () => {
  it("includes every source, severity ordering, metadata, and notes", () => {
    const report=buildReport(snapshot,undefined,new Date("2026-09-29T00:00:00Z"));
    for (const value of ["Full reproduction details", "Supporting context", "abc123", "Unverified hypothesis", "A second line", "2026-09-29"]) expect(report).toContain(value);
    expect(report.indexOf("### Access control")).toBeLessThan(report.indexOf("### Minor issue"));
    expect(report).toContain("2 findings remain unresolved, including 1 rated High or Critical");
    expect(report).toContain("## Recommendations");
  });
  it("does not invent assurance or testing for empty projects", () => {
    const report=buildReport({...snapshot,findings:[],evidence:[],notes:[]});
    expect(report).toContain("does not establish that the project is free of vulnerabilities");
    expect(report).toContain("No research notes recorded");
  });
  it("retains all records alongside the AI narrative and escapes structural Markdown", () => {
    const report=buildReport({...snapshot, notes:[{id:"note",title:"# Fake section",content:"<script>ignore()</script>"}]},{summary:"AI summary",methodology:"Recorded approach",recommendations:"Suggested retest"});
    expect(report).toContain("AI summary");expect(report).toContain("Full reproduction details");
    expect(report).toContain("\\# Fake section");expect(report).not.toContain("<script>");
  });
});
describe("local AI adapter", () => {
  it("does not make network calls unless configured", async () => {
    vi.stubEnv("OLLAMA_MODEL","");const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
    expect((await generateNarrative(snapshot)).narrative).toBeUndefined();expect(fetcher).not.toHaveBeenCalled();
  });
  it("uses all three record types and accepts a complete structured response", async () => {
    vi.stubEnv("OLLAMA_MODEL","local-model");
    const narrative={summary:"Summary",methodology:"Approach",recommendations:"Retest"};
    const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({done:true,response:JSON.stringify(narrative)})));
    vi.stubGlobal("fetch",fetcher);
    expect((await generateNarrative(snapshot)).narrative).toEqual(narrative);
    const payload=JSON.parse(fetcher.mock.calls[0][1].body);
    expect(payload.prompt).toContain("Research hypotheses");expect(payload.prompt).toContain("Supporting context");expect(payload.prompt).toContain("Access control");
  });
  it.each(["offline","malformed","truncated"])("falls back without losing records when %s", async (failure) => {
    vi.stubEnv("OLLAMA_MODEL","local-model");
    vi.stubGlobal("fetch", failure==="offline" ? vi.fn().mockRejectedValue(new Error("offline")) : vi.fn().mockResolvedValue(new Response(JSON.stringify({done:failure!=="truncated",response:"bad json"}))));
    const result=await generateNarrative(snapshot);
    expect(result.narrative).toBeUndefined();expect(buildReport(snapshot,result.narrative,new Date(),result.status)).toContain("Unverified hypothesis");
  });
  it("never silently truncates large inputs", async () => {
    vi.stubEnv("OLLAMA_MODEL","local-model");const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
    const input={...snapshot,notes:[{id:"large",title:"Long note",content:"x".repeat(41000)}]};
    const result=await generateNarrative(input);expect(result.status).toContain("input budget");expect(fetcher).not.toHaveBeenCalled();expect(buildReport(input)).toContain("x".repeat(41000));
  });
});
