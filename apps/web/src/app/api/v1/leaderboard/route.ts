import { NextResponse } from "next/server";
import { z } from "zod";

import { groupReliability } from "@orivoxx/results";

import { webLeaderboard } from "@/server/results";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const querySchema = z.object({
  taskId: z
    .string()
    .regex(/^[a-z][a-z0-9-]{1,63}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  kind: z.enum(["agents", "baselines", "all"]).optional(),
});

const NO_STORE = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
} as const;

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    taskId: url.searchParams.get("taskId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    kind: url.searchParams.get("kind") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_query",
          message:
            "taskId must be kebab-case, limit must be 1 to 200, and kind must be agents, baselines, or all.",
        },
      },
      { status: 400, headers: NO_STORE },
    );
  }

  const leaderboard = await webLeaderboard(parsed.data);
  const reliability = groupReliability(leaderboard.entries).map((group) => ({
    adapterId: group.adapterId,
    taskId: group.taskId,
    profile: group.profile,
  }));

  return NextResponse.json(
    {
      entries: leaderboard.entries,
      reliability,
      store: leaderboard.store,
      degraded: leaderboard.degraded,
      readOnly: leaderboard.readOnly,
      baselinesOnly: leaderboard.baselinesOnly,
      ...(leaderboard.problem === undefined ? {} : { problem: leaderboard.problem }),
      generatedAt: new Date().toISOString(),
    },
    { status: 200, headers: NO_STORE },
  );
}
