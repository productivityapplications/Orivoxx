import { NextResponse } from "next/server";
import { z } from "zod";

import { webResult } from "@/server/results";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.object({ resultId: z.string().min(1).max(64), candidateIndex: z.number().int().min(0).max(5).optional() }).strict();

export async function POST(request: Request): Promise<NextResponse> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "invalid_input", message: "Invalid JSON." } }, { status: 400 });
  }
  const input = requestSchema.safeParse(parsed);
  if (!input.success) {
    return NextResponse.json({ error: { code: "invalid_input", message: "resultId is required." } }, { status: 400 });
  }
  const read = await webResult(input.data.resultId);
  const attribution = read.result?.attribution;
  if (read.result === null || attribution === null || attribution === undefined) {
    return NextResponse.json({ error: { code: "replay_unavailable", message: "No replay proof is stored for this result." } }, { status: 409 });
  }
  const candidate = attribution.candidates[input.data.candidateIndex ?? 0];
  return NextResponse.json({
    resultId: read.result.resultId,
    baseline: attribution.proof?.baseline ?? null,
    intervention: candidate?.intervention ?? attribution.proof?.intervention ?? null,
    counterfactual: candidate?.counterfactual ?? attribution.proof?.counterfactual ?? null,
    candidates: attribution.candidates,
  });
}
