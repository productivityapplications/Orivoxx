import { db } from "./db";
import { getSession } from "./session";

// Synthetic fixture: no real auth.
export async function requireSession() {
  return getSession();
}

export async function assertProjectOwner(
  session: { userId: string },
  projectId: string,
): Promise<void> {
  const project = await db.getProject(projectId);

  if (!project || project.ownerId !== session.userId) {
    throw new Error("Forbidden");
  }
}
