import { ResultIdSchema } from "@orivoxx/results";
import { NextResponse } from "next/server";

import { webResult } from "@/server/results";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
} as const;

function notFound(): NextResponse {
  return NextResponse.json(
    { error: { code: "not_found", message: "No result with that id is stored." } },
    { status: 404, headers: NO_STORE },
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;

  if (!ResultIdSchema.safeParse(id).success) {
    return notFound();
  }

  const read = await webResult(id);

  if (read.result === null) {
    return notFound();
  }

  return NextResponse.json(
    {
      result: read.result,
      store: read.store,
      degraded: read.degraded,
      readOnly: read.readOnly,
      ...(read.problem === undefined ? {} : { problem: read.problem }),
    },
    { status: 200, headers: NO_STORE },
  );
}
