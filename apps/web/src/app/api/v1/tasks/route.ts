import { NextResponse } from "next/server";

import { parseTestCommand } from "@orivoxx/harness";

import { viewer } from "@/server/auth";
import {
  CreateTaskInputSchema,
  CommunityStoreError,
  createCommunityTask,
  listUserTasks,
} from "@/server/community-tasks";
import { taskSummaries } from "@/server/tasks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
} as const;

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  if (url.searchParams.get("mine") === "true") {
    const current = await viewer();
    try {
      const tasks = await listUserTasks(current.id);
      return NextResponse.json({ tasks, viewer: { id: current.id, username: current.username, anonymous: current.anonymous } }, { headers: HEADERS });
    } catch {
      return NextResponse.json({ tasks: [], viewer: { id: current.id, username: current.username, anonymous: current.anonymous } }, { headers: HEADERS });
    }
  }
  return NextResponse.json({ tasks: taskSummaries() }, { headers: HEADERS });
}

export async function POST(request: Request): Promise<NextResponse> {
  const current = await viewer();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "invalid_input", message: "Invalid JSON body." } }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Buffer.byteLength(JSON.stringify(body)) > 16_384) {
    return NextResponse.json({ error: { code: "invalid_input", message: "The task body is invalid or too large." } }, { status: 400 });
  }

  const parsed = CreateTaskInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_input",
          message: "repoUrl must be a GitHub repository; baseCommit must be hex; issueText and testCommand are required.",
        },
      },
      { status: 400 },
    );
  }

  try {
    parseTestCommand(parsed.data.testCommand);
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_test_command", message: "testCommand must be one allowlisted argv command." } },
      { status: 400 },
    );
  }

  try {
    const task = await createCommunityTask(parsed.data, current.id);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    if (error instanceof CommunityStoreError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.code === "rate_limited" ? 429 : 503 },
      );
    }
    return NextResponse.json(
      { error: { code: "task_failed", message: "The task could not be queued." } },
      { status: 500 },
    );
  }
}
