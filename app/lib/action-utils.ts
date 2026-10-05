import "server-only";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { ValidationError, type ActionResult } from "./validation";

export async function session() {
  const { userId } = await auth();
  if (!userId) throw new ValidationError("Your session has ended. Sign in and try again.");
  return userId;
}
export async function attempt<T>(operation: () => Promise<T>): Promise<ActionResult<T>> {
  try { return { ok: true, data: await operation() }; }
  catch (error) {
    if (error instanceof ValidationError) return { ok: false, error: error.message };
    console.error("ScopeLog operation failed", error instanceof Error ? error.name : "UnknownError");
    return { ok: false, error: "We couldn't save that change. Please try again. Your input has been kept." };
  }
}
export function refreshData() { revalidatePath("/", "layout"); }
