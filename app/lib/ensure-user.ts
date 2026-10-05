import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./schema";

export async function ensureUser() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (existingUser.length > 0) {
    return existingUser[0];
  }

  const [newUser] = await db
    .insert(users)
    .values({
      clerkId: userId,
    })
    .onConflictDoUpdate({ target: users.clerkId, set: { clerkId: userId } })
    .returning();

  return newUser;
}
