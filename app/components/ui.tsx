"use client";
import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2, X } from "lucide-react";
import type { ActionResult } from "../lib/validation";

export function Modal({ title, description, onClose, children, wide = false }: { title: string; description?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null), titleId = useId();
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} aria-labelledby={titleId} className={`modal ${wide ? "max-w-4xl" : "max-w-xl"}`} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose(); } }}><div className="flex items-start justify-between gap-4"><div><h2 id={titleId} className="mt-2 text-xl font-semibold">{title}</h2>{description && <p className="mt-2 text-sm leading-6 text-[#9aa8b1]">{description}</p>}</div><button type="button" aria-label="Close dialog" className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="mt-6">{children}</div></dialog>;
}
export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="label block">{label}<span className="mt-2 block">{children}</span></label>; }
export function ActionForm({ action, children, onSuccess, label = "Save", reset = false }: { action: (form: FormData) => Promise<ActionResult<unknown>>; children: ReactNode; onSuccess?: (data: unknown) => void; label?: string; reset?: boolean }) {
  const [error, setError] = useState(""), [success, setSuccess] = useState(false), [pending, startTransition] = useTransition();
  const router = useRouter();
  return <form className="space-y-4" onSubmit={event => {
    event.preventDefault(); if (pending) return;
    const form = event.currentTarget, data = new FormData(form); setError(""); setSuccess(false);
    startTransition(async () => { try { const result = await action(data); if (!result.ok) { setError(result.error); return; } if (reset) form.reset(); setSuccess(true); onSuccess?.(result.data); router.refresh(); } catch { setError("Connection interrupted. Please try again; your input has been kept."); } });
  }}><fieldset disabled={pending} className="space-y-4">{children}</fieldset>{error && <p className="error-message" role="alert">{error}</p>}<div className="flex items-center justify-end gap-3">{success && !onSuccess && <span className="text-xs text-[#acd5c7]" role="status">Saved successfully</span>}<button disabled={pending} className="button" type="submit">{pending && <LoaderCircle size={14} className="animate-spin" />}{pending ? "Saving…" : label}</button></div></form>;
}
export function DeleteButton({ action, name, description, onDeleted, label = "Delete" }: { action: () => Promise<ActionResult<unknown>>; name: string; description?: string; onDeleted?: () => void; label?: string }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className="icon-button text-[#dcaeb2]" aria-label={`${label} ${name}`} title={`${label} ${name}`} onClick={() => setOpen(true)}><Trash2 size={15} /></button>{open && <Modal title={`${label} ${name}?`} description={description || "This permanently removes the record. This action cannot be undone."} onClose={() => setOpen(false)}><ActionForm action={action} label={`Confirm ${label.toLowerCase()}`} onSuccess={() => { setOpen(false); onDeleted?.(); }}><p className="text-sm text-[#a8b3ba]">Review this action before continuing.</p></ActionForm></Modal>}</>;
}
export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const color = tone === "Critical" || tone === "High" ? "border-[#70454e] bg-[#301e24] text-[#f0b2bd]" : tone === "Resolved" || tone === "Complete" || tone === "Final" ? "border-[#365a50] bg-[#192c26] text-[#afd5c8]" : tone === "Medium" || tone === "In review" ? "border-[#66563e] bg-[#2d271e] text-[#dec894]" : "";
  return <span className={`badge ${color}`}>{children}</span>;
}
export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) { return <section className="panel"><div className="panel-heading"><h2>{title}</h2>{action}</div>{children}</section>; }
export function Empty({ children }: { children: ReactNode }) { return <div className="panel-empty"><span className="empty-symbol" aria-hidden="true">⌖</span><p>{children}</p></div>; }
export function HiddenScope({ workspaceId, projectId }: { workspaceId: string; projectId: string }) { return <><input type="hidden" name="workspaceId" value={workspaceId} /><input type="hidden" name="projectId" value={projectId} /></>; }

