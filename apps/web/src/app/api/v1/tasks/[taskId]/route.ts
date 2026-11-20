import { NextResponse } from "next/server";

import { CURATED_REAL_TASKS } from "@orivoxx/benchmarks";

import { viewer } from "@/server/auth";
import { canView, getCommunityTask, validationEvents } from "@/server/community-tasks";
import { taskDetail } from "@/server/tasks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
} as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ taskId: string }> },
): Promise<NextResponse> {
  const { taskId } = await context.params;
  const current = await viewer();
  let real = await getCommunityTask(taskId).catch(() => null);
  if (real === null) real = CURATED_REAL_TASKS.find((entry) => entry.id === taskId) ?? null;

  if (real !== null) {
    if (!canView(real, current.id)) {
      return NextResponse.json(
        { error: { code: "forbidden", message: "This task is private." } },
        { status: 403, headers: HEADERS },
      );
    }
    const events = await validationEvents(taskId).catch(() => []);
    return NextResponse.json(
      { task: real, validationEvents: events, viewer: { id: current.id, username: current.username, anonymous: current.anonymous } },
      { headers: HEADERS },
    );
  }

  const task = taskDetail(taskId);

  if (task === null) {
    return NextResponse.json(
      { error: { code: "not_found", message: "No benchmark task with that id exists." } },
      { status: 404, headers: HEADERS },
    );
  }

  return NextResponse.json({ task }, { headers: HEADERS });
}
