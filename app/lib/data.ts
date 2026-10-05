import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { workspaces } from "./schema";
import { id, ValidationError } from "./validation";

export async function getAuthenticatedUser() {
  const { userId } = await auth();
  return userId;
}

export async function requireWorkspace(workspaceId: string, clerkId: string) {
  id(workspaceId, "Workspace");
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.clerkId, clerkId)))
    .limit(1);

  if (!workspace) throw new ValidationError("Workspace not found.");
  return workspace;
}
