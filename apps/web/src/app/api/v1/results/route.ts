import { NextResponse } from "next/server";
import { z } from "zod";

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

const HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
} as const;

/** Alias of the leaderboard projection, for clients that key on results. */
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
          message: "taskId must be kebab-case and limit must be an integer from 1 to 200.",
        },
      },
      { status: 400, headers: HEADERS },
    );
  }

  const leaderboard = await webLeaderboard(parsed.data);

  return NextResponse.json(
    {
      results: leaderboard.entries,
      store: leaderboard.store,
      degraded: leaderboard.degraded,
      readOnly: leaderboard.readOnly,
      baselinesOnly: leaderboard.baselinesOnly,
      ...(leaderboard.problem === undefined ? {} : { problem: leaderboard.problem }),
    },
    { headers: HEADERS },
  );
}
