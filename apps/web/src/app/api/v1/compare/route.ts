import { NextResponse } from "next/server";
import { groupReliability } from "@orivoxx/results";

import { webResult } from "@/server/results";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const a = url.searchParams.get("a");
  const b = url.searchParams.get("b");
  if (a === null || b === null) {
    return NextResponse.json({ error: { code: "invalid_query", message: "a and b are required." } }, { status: 400 });
  }
  const [aRead, bRead] = await Promise.all([webResult(a), webResult(b)]);
  if (aRead.result === null || bRead.result === null) {
    return NextResponse.json({ error: { code: "not_found", message: "One or both results were not found." } }, { status: 404 });
  }
  const left = aRead.result;
  const right = bRead.result;
  const metrics = ["steps", "toolCalls", "toolErrorRate", "totalTokens", "costUsd", "durationMs"] as const;
  return NextResponse.json({
    a: { resultId: left.resultId, overall: left.overall, benches: left.benches, attribution: left.attribution, metrics: left.metrics ?? null, trace: (left.trace ?? []).slice(0, 20) },
    b: { resultId: right.resultId, overall: right.overall, benches: right.benches, attribution: right.attribution, metrics: right.metrics ?? null, trace: (right.trace ?? []).slice(0, 20) },
    deltas: Object.fromEntries(metrics.map((key) => [key, (right.metrics?.[key] ?? 0) - (left.metrics?.[key] ?? 0)])),
    attributionDiff: groupReliability([left, right]).map((group) => ({ adapterId: group.adapterId, profile: group.profile })),
  });
}
