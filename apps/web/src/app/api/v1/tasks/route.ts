import { NextResponse } from "next/server";

import { taskSummaries } from "@/server/tasks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
} as const;

export function GET(): NextResponse {
  return NextResponse.json({ tasks: taskSummaries() }, { headers: HEADERS });
}
