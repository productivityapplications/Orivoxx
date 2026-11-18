import { NextResponse } from "next/server";

import { webResult } from "@/server/results";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
): Promise<NextResponse> {
  const { runId } = await context.params;
  const read = await webResult(runId);

  if (read.result === null) {
    return NextResponse.json(
      { error: { code: "not_found", message: "No result with that id is stored." } },
      { status: 404 },
    );
  }

  if (read.result.attribution === null || read.result.attribution === undefined) {
    return NextResponse.json(
      {
        attribution: null,
        reason: read.result.attributionReason ?? "not attributable with the current ruleset",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    attribution: read.result.attribution,
    metrics: read.result.metrics ?? null,
    chaos: read.result.chaos ?? null,
  });
}
