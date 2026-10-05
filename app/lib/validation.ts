export class ValidationError extends Error {}
export const categories = ["Vulnerability", "Security issue", "Positive observation", "Informational", "Other"] as const;
export const severities = ["Critical", "High", "Medium", "Low", "Informational"] as const;
export const findingStatuses = ["Open", "In review", "Resolved"] as const;
export const evidenceKinds = ["Screenshot", "Request / response", "Log", "Document", "Link", "General information"] as const;
export const reportStatuses = ["Draft", "In review", "Final"] as const;
export const priorities = ["High", "Medium", "Low"] as const;
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export function text(value: unknown, label: string, max = 200, optional = false): string {
  if (typeof value !== "string" && value != null) throw new ValidationError(`${label} must be text.`);
  const result = typeof value === "string" ? value.trim() : "";
  if (!optional && !result) throw new ValidationError(`${label} is required.`);
  if (result.length > max) throw new ValidationError(`${label} must be ${max.toLocaleString()} characters or fewer.`);
  return result;
}
export function choice<T extends string>(value: unknown, choices: readonly T[], label: string): T {
  if (typeof value !== "string" || !choices.includes(value as T)) throw new ValidationError(`Choose a valid ${label.toLowerCase()}.`);
  return value as T;
}
export function isId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function id(value: unknown, label = "Record"): string {
  if (!isId(value)) throw new ValidationError(`${label} not found.`);
  return value;
}
export function integer(value: unknown, min: number, max: number, label: string): number {
  const n = typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max) throw new ValidationError(`${label} must be a whole number between ${min} and ${max}.`);
  return n;
}
export function dueDate(value: unknown): Date | null {
  if (value === "" || value == null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ValidationError("Enter a valid due date.");
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new ValidationError("Enter a valid due date.");
  return date;
}
export function sourceUrl(value: unknown): string | null {
  const url = text(value, "Source URL", 2000, true);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
    return parsed.href;
  } catch { throw new ValidationError("Use a complete http or https source URL without credentials."); }
}
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
