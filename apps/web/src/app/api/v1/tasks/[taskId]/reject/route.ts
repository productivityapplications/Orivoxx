import { NextResponse } from "next/server";

import { viewer } from "@/server/auth";
import { isCurator, rejectTask } from "@/server/community-tasks";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ taskId: string }> }): Promise<NextResponse> {
  const current = await viewer();
  if (current.username === null || !isCurator(current.username)) {
    return NextResponse.json({ error: { code: "forbidden", message: "Curator only." } }, { status: 403 });
  }
  let reason = "Rejected by curator.";
  try {
    const body = (await request.json()) as { reason?: unknown };
    if (typeof body.reason === "string" && body.reason.trim().length > 0) reason = body.reason.slice(0, 400);
  } catch {
    // Keep the default reason.
  }
  const { taskId } = await context.params;
  const task = await rejectTask(taskId, reason);
  if (task === null) return NextResponse.json({ error: { code: "not_found", message: "Task not found." } }, { status: 404 });
  return NextResponse.json({ task });
}
