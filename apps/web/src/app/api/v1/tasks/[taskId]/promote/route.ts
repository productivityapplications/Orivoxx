import { NextResponse } from "next/server";

import { viewer } from "@/server/auth";
import { getCommunityTask, isCurator, promoteTask } from "@/server/community-tasks";

export const dynamic = "force-dynamic";

export async function PATCH(_request: Request, context: { params: Promise<{ taskId: string }> }): Promise<NextResponse> {
  const current = await viewer();
  if (current.username === null || !isCurator(current.username)) {
    return NextResponse.json({ error: { code: "forbidden", message: "Curator only." } }, { status: 403 });
  }
  const { taskId } = await context.params;
  const existing = await getCommunityTask(taskId);
  if (existing === null) return NextResponse.json({ error: { code: "not_found", message: "Task not found." } }, { status: 404 });
  if (existing.status !== "validated") {
    return NextResponse.json({ error: { code: "invalid_state", message: "Only validated tasks can be promoted." } }, { status: 409 });
  }
  const task = await promoteTask(taskId);
  return NextResponse.json({ task });
}
