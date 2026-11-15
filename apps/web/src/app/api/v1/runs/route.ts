import { NextResponse } from "next/server";
import { z } from "zod";

import { runFakeBenchmark } from "@/server/runs";
import { taskDetail } from "@/server/tasks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const BODY_LIMIT_BYTES = 4_096;

const requestSchema = z
  .object({
    taskId: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
    variant: z.enum(["compliant", "regressed"]),
  })
  .strict();

const HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
} as const;

function error(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status, headers: HEADERS });
}

export async function POST(request: Request): Promise<NextResponse> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().startsWith("application/json")) {
    return error("invalid_content_type", "Send an application/json body.", 415);
  }

  const raw = await request.text();

  if (Buffer.byteLength(raw, "utf8") > BODY_LIMIT_BYTES) {
    return error("body_too_large", "The request body is too large.", 413);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return error("invalid_input", "The request body is not valid JSON.", 400);
  }

  const input = requestSchema.safeParse(parsed);

  if (!input.success) {
    return error(
      "invalid_input",
      "taskId must be a known kebab-case task and variant must be compliant or regressed.",
      400,
    );
  }

  if (taskDetail(input.data.taskId) === null) {
    return error("invalid_input", "That task does not exist.", 400);
  }

  try {
    const { result, store } = await runFakeBenchmark(input.data.taskId, input.data.variant);

    return NextResponse.json(
      {
        resultId: result.resultId,
        taskId: result.taskId,
        adapterId: result.adapter.id,
        overall: result.overall,
        createdAt: result.createdAt,
        store,
      },
      { status: 201, headers: HEADERS },
    );
  } catch (cause) {
    const code =
      cause !== null && typeof cause === "object" && "code" in cause
        ? String((cause as { code?: unknown }).code)
        : "run_failed";

    if (code === "invalid_run_input" || code === "unknown_task") {
      return error("invalid_input", "That task or fixture variant does not exist.", 400);
    }

    if (code === "duplicate_result") {
      return error("duplicate_result", "The result already exists.", 409);
    }

    return error("run_failed", "The benchmark run could not be completed. Try again.", 500);
  }
}
