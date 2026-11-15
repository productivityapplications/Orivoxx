import { NextResponse } from "next/server";

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
  const task = taskDetail(taskId);

  if (task === null) {
    return NextResponse.json(
      { error: { code: "not_found", message: "No benchmark task with that id exists." } },
      { status: 404, headers: HEADERS },
    );
  }

  return NextResponse.json({ task }, { headers: HEADERS });
}
