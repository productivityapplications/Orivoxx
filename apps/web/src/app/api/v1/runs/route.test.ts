import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GET as tasksRoute } from "@/app/api/v1/tasks/route";
import { GET as taskRoute } from "@/app/api/v1/tasks/[taskId]/route";
import { POST as runsRoute } from "@/app/api/v1/runs/route";

const directories: string[] = [];

async function resultsDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "orivoxx-web-runs-"));
  directories.push(directory);
  return directory;
}

beforeEach(() => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function runRequest(body: unknown, contentType = "application/json"): Request {
  return new Request("http://localhost/api/v1/runs", {
    method: "POST",
    headers: { "content-type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/v1/runs", () => {
  it("runs the fake baseline, stores the result, and returns its id", async () => {
    const directory = await resultsDirectory();
    vi.stubEnv("ORIVOXX_DATA_DIR", directory);

    const response = await runsRoute(runRequest({ taskId: "taskboard", variant: "compliant" }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.resultId).toMatch(/^res_[a-z0-9]{10,40}$/);
    expect(body.taskId).toBe("taskboard");
    expect(body.adapterId).toBe("fake");
    expect(body.overall).toBe(99.5);
    expect(body.store).toBe("local");
    expect(response.headers.get("cache-control")).toBe("no-store");

    const files = await readdir(directory);

    expect(files).toContain(`${body.resultId}.json`);
  });

  it("stores the regressed fixture with its cap", async () => {
    const directory = await resultsDirectory();
    vi.stubEnv("ORIVOXX_DATA_DIR", directory);

    const response = await runsRoute(runRequest({ taskId: "taskboard", variant: "regressed" }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.overall).toBe(59.9);
  });

  it("rejects an unknown task with 400", async () => {
    const response = await runsRoute(runRequest({ taskId: "does-not-exist", variant: "compliant" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_input" } });
  });

  it("rejects an invalid variant", async () => {
    const response = await runsRoute(runRequest({ taskId: "taskboard", variant: "cheat" }));

    expect(response.status).toBe(400);
  });

  it("rejects a non-JSON body and an oversized body", async () => {
    const wrongType = await runsRoute(runRequest("taskId=taskboard", "text/plain"));

    expect(wrongType.status).toBe(415);

    const tooLarge = await runsRoute(runRequest({ taskId: "taskboard", variant: "compliant", pad: "x".repeat(5000) }));

    expect(tooLarge.status).toBe(413);
    expect((await tooLarge.json()).error.code).toBe("body_too_large");
  });

  it("rejects malformed JSON without a stack trace", async () => {
    const response = await runsRoute(runRequest("{nope"));

    expect(response.status).toBe(400);
    const body = await response.json();

    expect(body.error.code).toBe("invalid_input");
    expect(JSON.stringify(body)).not.toContain("at ");
  });
});

describe("task routes", () => {
  it("lists task summaries with version fields", async () => {
    const response = await tasksRoute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.tasks.length).toBeGreaterThanOrEqual(2);
    expect(body.tasks[0]).toMatchObject({
      id: expect.any(String),
      version: expect.any(String),
      rulesetVersion: expect.any(String),
      scoringConfigVersion: expect.any(String),
    });
  });

  it("returns a task detail and a 404 envelope", async () => {
    const detail = await taskRoute(new Request("http://localhost/api/v1/tasks/taskboard"), {
      params: Promise.resolve({ taskId: "taskboard" }),
    });

    expect(detail.status).toBe(200);
    const body = await detail.json();

    expect(body.task.requirements.length).toBeGreaterThan(0);
    expect(body.task.specText).toContain("REQ-AUTH-001");

    const missing = await taskRoute(new Request("http://localhost/api/v1/tasks/nope"), {
      params: Promise.resolve({ taskId: "nope" }),
    });

    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ error: { code: "not_found" } });
  });
});
