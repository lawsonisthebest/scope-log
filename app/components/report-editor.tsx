"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Markdown from "react-markdown";
import { Check, Download, Eye, Pencil, Printer, Save } from "lucide-react";
import { updateReport } from "@/app/actions";
import { reportStatuses } from "../lib/validation";
import { Field } from "./ui";
type Report = {
  id: string;
  name: string;
  content: string;
  status: string;
  updatedAt: string;
};
export function ReportEditor({
  report,
  onSaved,
}: {
  report: Report;
  onSaved?: () => void;
}) {
  const [name, setName] = useState(report.name),
    [content, setContent] = useState(report.content),
    [status, setStatus] = useState(report.status),
    [preview, setPreview] = useState(true),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState({
    name: report.name,
    content: report.content,
    status: report.status,
  });
  const dirty =
    name !== saved.name || content !== saved.content || status !== saved.status;
  const editor = useRef<HTMLTextAreaElement>(null),
    router = useRouter();
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function insert(prefix: string, suffix = "") {
    const el = editor.current;
    if (!el) return;
    const start = el.selectionStart,
      end = el.selectionEnd;
    setContent(
      `${content.slice(0, start)}${prefix}${content.slice(start, end)}${suffix}${content.slice(end)}`,
    );
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, end + prefix.length);
    });
  }
  function save() {
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const result = await updateReport(report.id, name, content, status);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSaved({ name, content, status });
        setMessage("All changes saved");
        router.refresh();
        onSaved?.();
      } catch {
        setError(
          "Connection interrupted. Your draft is still in the editor. Try saving again.",
        );
      }
    });
  }
  function download() {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^a-z0-9 _-]/gi, "_").slice(0, 100) || "assessment"}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <Field label="Report name">
          <input
            className="field"
            aria-label="Report name"
            maxLength={200}
            value={name}
            disabled={pending}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Status">
          <select
            className="field"
            value={status}
            disabled={pending}
            onChange={(e) => setStatus(e.target.value)}
          >
            {reportStatuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#29323a] py-3">
        <div className="flex flex-wrap gap-2">
          <button
            className="button-secondary"
            onClick={() => setPreview(!preview)}
          >
            {preview ? <Pencil size={14} /> : <Eye size={14} />}{" "}
            {preview ? "Edit" : "Preview"}
          </button>
          {!preview && (
            <>
              <button
                className="button-secondary"
                onClick={() => insert("## ")}
              >
                Heading
              </button>
              <button
                className="button-secondary font-bold"
                onClick={() => insert("**", "**")}
              >
                Bold
              </button>
              <button className="button-secondary" onClick={() => insert("- ")}>
                List
              </button>
              <button
                className="button-secondary"
                onClick={() => insert("```\n", "\n```")}
              >
                Code
              </button>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {preview && (
            <button className="button-secondary" onClick={() => window.print()}>
              <Printer size={14} />
              Print / PDF
            </button>
          )}
          <button className="button-secondary" onClick={download}>
            <Download size={14} />
            Export Markdown
          </button>
        </div>
      </div>
      {preview ? (
        <article className="prose report-paper report-print">
          <Markdown
            skipHtml
            components={{
              img: ({ alt }) => <span>[Image: {alt || "attachment"}]</span>,
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {content || "*This report is empty.*"}
          </Markdown>
        </article>
      ) : (
        <textarea
          ref={editor}
          aria-label="Report content"
          value={content}
          disabled={pending}
          maxLength={Math.max(200000, report.content.length)}
          onChange={(e) => setContent(e.target.value)}
          className="field min-h-[520px] resize-y font-mono text-[13px] leading-7"
          placeholder="Write your assessment…"
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          role="status"
          className="flex items-center gap-2 text-xs text-[#99b5a9]"
        >
          {dirty ? (
            "Unsaved changes"
          ) : (
            <>
              <Check size={13} />
              {message || "Saved report"}
            </>
          )}
          <span className="text-[#89969e]">
            · {content.trim() ? content.trim().split(/\s+/).length : 0} words
          </span>
        </p>
        <button className="button" disabled={pending || !dirty} onClick={save}>
          <Save size={14} />
          {pending ? "Saving…" : "Save report"}
        </button>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <p className="text-xs leading-5 text-[#89969e]">
        Reports are saved when you select Save report. Export includes the text
        currently in the editor. Drafts are snapshots; later project changes do
        not overwrite your narrative.
      </p>
    </div>
  );
}
