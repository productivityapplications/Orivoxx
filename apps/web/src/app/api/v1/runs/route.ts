import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { checkSameOrigin } from "@/server/origin";
import {
  checkRunRateLimit,
  clientIdentifier,
  rateLimitHeaders,
  type RateLimitOutcome,
} from "@/server/rate-limit";
import { runsDisabled } from "@/server/env";
import { acquireFakeRunSlot, runFakeBenchmark } from "@/server/runs";
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

const SAFE_HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
} as const;

function requestIdOf(request: Request): string {
  const inbound = request.headers.get("x-request-id");

  if (inbound !== null && /^[A-Za-z0-9-]{8,64}$/.test(inbound)) {
    return inbound;
  }

  return randomUUID();
}

function error(
  requestId: string,
  code: string,
  message: string,
  status: number,
  extra: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(
    { error: { code, message, requestId } },
    { status, headers: { ...SAFE_HEADERS, ...extra, "x-request-id": requestId } },
  );
}

function rateLimitMessage(outcome: RateLimitOutcome): string {
  return outcome.reason === "unavailable"
    ? "Run submission is temporarily unavailable because shared rate limiting is not reachable."
    : "Too many run submissions from this client. Try again later.";
}

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = requestIdOf(request);

  const origin = checkSameOrigin(request, process.env.APP_BASE_URL);

  if (!origin.ok) {
    return error(
      requestId,
      "forbidden_origin",
      "Mutating requests must come from the same origin.",
      403,
    );
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().startsWith("application/json")) {
    return error(requestId, "invalid_content_type", "Send an application/json body.", 415);
  }

  if (runsDisabled()) {
    return error(
      requestId,
      "runs_disabled",
      "Run submission is temporarily disabled by the operator.",
      503,
    );
  }

  const outcome = await checkRunRateLimit(clientIdentifier(request));

  if (!outcome.allowed) {
    const status = outcome.reason === "limited" ? 429 : 503;

    return error(
      requestId,
      outcome.reason === "limited" ? "rate_limited" : "rate_limit_unavailable",
      rateLimitMessage(outcome),
      status,
      rateLimitHeaders(outcome, { retryAfter: true }),
    );
  }

  const rateHeaders = rateLimitHeaders(outcome);
  const raw = await request.text();

  if (Buffer.byteLength(raw, "utf8") > BODY_LIMIT_BYTES) {
    return error(requestId, "body_too_large", "The request body is too large.", 413, rateHeaders);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return error(requestId, "invalid_input", "The request body is not valid JSON.", 400, rateHeaders);
  }

  const input = requestSchema.safeParse(parsed);

  if (!input.success) {
    return error(
      requestId,
      "invalid_input",
      "taskId must be a known kebab-case task and variant must be compliant or regressed.",
      400,
      rateHeaders,
    );
  }

  if (taskDetail(input.data.taskId) === null) {
    return error(requestId, "invalid_input", "That task does not exist.", 400, rateHeaders);
  }

  const release = acquireFakeRunSlot();

  if (release === null) {
    return error(
      requestId,
      "too_many_runs",
      "Two runs are already in progress on this instance. Try again shortly.",
      429,
      rateHeaders,
    );
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
        requestId,
      },
      {
        status: 201,
        headers: {
          ...SAFE_HEADERS,
          ...rateHeaders,
          "x-request-id": requestId,
        },
      },
    );
  } catch (cause) {
    const code =
      cause !== null && typeof cause === "object" && "code" in cause
        ? String((cause as { code?: unknown }).code)
        : "run_failed";

    if (code === "invalid_run_input" || code === "unknown_task") {
      return error(requestId, "invalid_input", "That task or fixture variant does not exist.", 400);
    }

    if (code === "duplicate_result") {
      return error(requestId, "duplicate_result", "The result already exists.", 409);
    }

    return error(
      requestId,
      "run_failed",
      "The benchmark run could not be completed. Try again.",
      500,
    );
  } finally {
    release();
  }
}
