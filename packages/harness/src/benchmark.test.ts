import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { getTask } from "@orivoxx/benchmarks";
import { BenchmarkResultSchema, toLeaderboardEntry } from "@orivoxx/results";

import { createFakeAdapter } from "./adapters/fake.js";
import { runBenchmark } from "./benchmark.js";
import type { AgentExecutor, ExecutionRequest } from "./contracts.js";
import { buildAdapterRunInput } from "./run.js";
import { createRunWorkspace, removeRunWorkspace } from "./workspace.js";

const workspaces: string[] = [];

async function workspace(): Promise<string> {
  const directory = await createRunWorkspace();
  workspaces.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    workspaces.splice(0).map((directory) =>
      removeRunWorkspace(directory).catch(() => undefined),
    ),
  );
});

function stubExecutor(onExecute?: (request: ExecutionRequest) => Promise<void>): AgentExecutor {
  return {
    id: "stub",
    async execute(request) {
      await onExecute?.(request);

      return {
        exitCode: 0,
        timedOut: false,
        durationMs: 25,
        stdout: "agent finished\n",
        stderr: "",
      };
    },
  };
}

describe("benchmark run", () => {
  it("builds an immutable result record from a sandboxed run", async () => {
    const task = getTask("taskboard");
    const run = await runBenchmark({
      task,
      adapter: createFakeAdapter({ taskId: "taskboard", variant: "compliant" }),
      workspace: await workspace(),
      resultId: "res_benchmark000000000001",
      now: () => new Date("2026-11-15T12:00:00.000Z"),
    });

    expect(run.result.overall).toBe(99.5);
    expect(run.result.createdAt).toBe("2026-11-15T12:00:00.000Z");
    expect(run.result.adapter.id).toBe("fake");
    expect(run.result.model).toBeNull();
    expect(run.result.tally).toEqual({ passed: 9, failed: 0, drifted: 0, unverified: 0 });
    expect(run.result.score).toEqual(run.evaluation.score);
    expect(run.result.repositoryFingerprint).toBe(run.run.repositoryFingerprint);

    expect(BenchmarkResultSchema.safeParse(run.result).success).toBe(true);
  });

  it("records the produced-code diff as bounded text", async () => {
    const task = getTask("taskboard");
    const run = await runBenchmark({
      task,
      adapter: createFakeAdapter({ taskId: "taskboard", variant: "compliant" }),
      workspace: await workspace(),
      resultId: "res_benchmark000000000002",
    });

    expect(run.result.diff.addedFiles + run.result.diff.changedFiles).toBeGreaterThan(0);
    expect(run.result.diff.text).toContain("+++ b/src/lib/auth.ts");
    expect(run.result.diff.text).not.toContain("sk-or-v1-");

    const entry = toLeaderboardEntry(run.result);

    expect(entry.overall).toBe(run.result.overall);
  });

  it("keeps the critical cap in the stored result", async () => {
    const task = getTask("taskboard");
    const run = await runBenchmark({
      task,
      adapter: createFakeAdapter({ taskId: "taskboard", variant: "regressed" }),
      workspace: await workspace(),
      resultId: "res_benchmark000000000003",
    });

    expect(run.result.capsApplied).toEqual(["critical-spec-failure"]);
    expect(run.result.appliedCap).toBe(59.9);
    expect(run.result.overall).toBeLessThanOrEqual(59.9);
    expect(run.result.tally.failed).toBeGreaterThan(0);
  });

  it("runs a process adapter through the executor and scores the output", async () => {
    const task = getTask("taskboard");
    const input = buildAdapterRunInput(task);
    const run = await runBenchmark({
      task,
      adapter: {
        id: "process-agent",
        version: "2.1.0",
        label: "Process agent",
        kind: "harness",
        model: {
          provider: "openrouter",
          name: "openai/gpt-4o-mini",
          baseUrl: "https://openrouter.ai/api/v1",
        },
        plan() {
          return {
            kind: "process",
            command: { file: "node", args: ["agent.mjs"], env: { MODEL_NAME: "openai/gpt-4o-mini" } },
          };
        },
      },
      input,
      workspace: await workspace(),
      executor: stubExecutor(async (request) => {
        await mkdir(join(request.workspace, "src", "components"), { recursive: true });
        await writeFile(
          join(request.workspace, "src", "components", "TaskList.tsx"),
          "export function TaskList() { return null; }\n",
          { encoding: "utf8", flag: "w" },
        );
      }),
      resultId: "res_benchmark000000000004",
    });

    expect(run.result.adapterVersion).toBe("2.1.0");
    expect(run.result.model?.name).toBe("openai/gpt-4o-mini");
    expect(run.result.run).toEqual({ status: "completed", exitCode: 0, durationMs: 25 });
    expect(run.result.diff.files.map((file) => file.path)).toContain(
      "src/components/TaskList.tsx",
    );
  });

  it("keeps the score available when the run fails", async () => {
    const task = getTask("taskboard");

    const run = await runBenchmark({
      task,
      adapter: {
        id: "failing-agent",
        version: "1.0.0",
        label: "Failing agent",
        kind: "harness",
        model: null,
        plan() {
          return { kind: "process", command: { file: "node", args: ["agent.mjs"], env: {} } };
        },
      },
      workspace: await workspace(),
      executor: {
        id: "stub",
        async execute() {
          return { exitCode: 2, timedOut: false, durationMs: 5, stdout: "", stderr: "boom" };
        },
      },
      resultId: "res_benchmark000000000005",
    });

    expect(run.result.run.status).toBe("failed");
    expect(run.result.run.exitCode).toBe(2);
    expect(run.result.overall).toBeLessThan(99);
  });
});
