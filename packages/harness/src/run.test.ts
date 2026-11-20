import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { getTask } from "@orivoxx/benchmarks";

import { createFakeAdapter } from "./adapters/fake.js";
import { getAdapter, adapterSummaries } from "./adapters/registry.js";
import type {
  AdapterRunInput,
  AgentAdapter,
  AgentExecutor,
  ExecutionRequest,
} from "./contracts.js";
import { HarnessError } from "./errors.js";
import { buildAdapterRunInput, runAdapter } from "./run.js";
import {
  createRunWorkspace,
  removeRunWorkspace,
} from "./workspace.js";

const FIXED_RUN_ID = "3f6f0f5e-6b6f-4c3f-9a4e-0f6f0f5e6b6f";
const FIXED_NOW = () => new Date("2026-11-15T12:00:00.000Z");

const workspaces: string[] = [];

async function workspace(): Promise<string> {
  const dir = await createRunWorkspace();
  workspaces.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    workspaces.splice(0).map((dir) => removeRunWorkspace(dir).catch(() => undefined)),
  );
});

function taskboardInput(): AdapterRunInput {
  return buildAdapterRunInput(getTask("taskboard"));
}

function processAdapter(model = {
  provider: "openrouter",
  name: "openai/gpt-4o-mini",
  baseUrl: "https://openrouter.ai/api/v1",
}): AgentAdapter {
  return {
    id: "test-agent",
    version: "1.0.0",
    label: "Test agent",
    kind: "harness",
    model,
    plan() {
      return {
        kind: "process",
        command: {
          file: "/usr/local/bin/python3",
          args: ["agent.py", "--max-steps", "40"],
          env: {
            MODEL_NAME: model.name,
            MODEL_PROXY_URL: "http://model-proxy:8080/v1",
            PYTHONUNBUFFERED: "1",
          },
        },
      };
    },
  };
}

function stubExecutor(
  result: Partial<{
    exitCode: number | null;
    timedOut: boolean;
    durationMs: number;
    stdout: string;
    stderr: string;
  }> = {},
  onExecute?: (request: ExecutionRequest) => Promise<void>,
): AgentExecutor & { requests: ExecutionRequest[] } {
  const requests: ExecutionRequest[] = [];

  return {
    id: "stub",
    requests,
    async execute(request) {
      requests.push(request);
      await onExecute?.(request);

      return {
        exitCode: result.exitCode === undefined ? 0 : result.exitCode,
        timedOut: result.timedOut ?? false,
        durationMs: result.durationMs ?? 12,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
      };
    },
  };
}

describe("fake adapter", () => {
  it("materializes the compliant TaskBoard fixture without a model", async () => {
    const adapter = createFakeAdapter({ taskId: "taskboard", variant: "compliant" });
    const output = await runAdapter({
      adapter,
      input: taskboardInput(),
      workspace: await workspace(),
      runId: FIXED_RUN_ID,
      now: FIXED_NOW,
    });

    expect(output.status).toBe("completed");
    expect(output.exitCode).toBe(0);
    expect(output.model).toBeNull();
    expect(output.files.map((file) => file.path)).toContain(
      "src/app/api/projects/[id]/route.ts",
    );
    expect(output.files.map((file) => file.path)).toContain("src/lib/auth.ts");
    expect(output.repositoryFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(output.stats.fileCount).toBe(output.files.length);
  });

  it("produces a different fingerprint for the regressed fixture", async () => {
    const input = taskboardInput();
    const compliant = await runAdapter({
      adapter: createFakeAdapter({ taskId: "taskboard", variant: "compliant" }),
      input,
      workspace: await workspace(),
      runId: FIXED_RUN_ID,
      now: FIXED_NOW,
    });
    const regressed = await runAdapter({
      adapter: createFakeAdapter({ taskId: "taskboard", variant: "regressed" }),
      input,
      workspace: await workspace(),
      runId: FIXED_RUN_ID,
      now: FIXED_NOW,
    });

    expect(regressed.repositoryFingerprint).not.toBe(compliant.repositoryFingerprint);
  });

  it("refuses to run a fixture bound to another task", async () => {
    const adapter = createFakeAdapter({ taskId: "linkstash" });

    await expect(
      runAdapter({
        adapter,
        input: taskboardInput(),
        workspace: await workspace(),
      }),
    ).rejects.toMatchObject({ code: "invalid_run_input" });
  });
});

describe("adapter process runs", () => {
  it("passes an argv array to the executor and never a shell string", async () => {
    const executor = stubExecutor({}, async (request) => {
      await writeFile(join(request.workspace, "agent-output.ts"), "export const ok = 1;\n");
    });

    const output = await runAdapter({
      adapter: processAdapter(),
      input: taskboardInput(),
      workspace: await workspace(),
      executor,
      runId: FIXED_RUN_ID,
      now: FIXED_NOW,
    });

    expect(executor.requests).toHaveLength(1);
    expect(executor.requests[0]?.command.file).toBe("/usr/local/bin/python3");
    expect(executor.requests[0]?.command.args).toEqual([
      "agent.py",
      "--max-steps",
      "40",
    ]);
    expect(executor.requests[0]?.timeoutMs).toBe(900_000);
    expect(output.status).toBe("completed");
    expect(output.files.map((file) => file.path)).toContain("agent-output.ts");
  });

  it("redacts control sequences and secrets from bounded output summaries", async () => {
    const executor = stubExecutor({
      stdout:
        "\u001b[32mok\u001b[0m sk-or-v1-abcdefghijklmnopqrstuvwxyz012345",
    });

    const output = await runAdapter({
      adapter: processAdapter(),
      input: taskboardInput(),
      workspace: await workspace(),
      executor,
      runId: FIXED_RUN_ID,
      now: FIXED_NOW,
    });

    expect(output.stdoutSummary).not.toContain("\u001b[");
    expect(output.stdoutSummary).not.toContain("sk-or-v1-abcdefghijklmnopqrstuvwxyz012345");
    expect(output.stdoutSummary).toContain("ok");
  });

  it("records a timeout with no exit code", async () => {
    const executor = stubExecutor({ timedOut: true, exitCode: null });

    const output = await runAdapter({
      adapter: processAdapter(),
      input: taskboardInput(),
      workspace: await workspace(),
      executor,
      runId: FIXED_RUN_ID,
      now: FIXED_NOW,
    });

    expect(output.status).toBe("timeout");
    expect(output.exitCode).toBeNull();
  });

  it("records a failed process without losing the captured workspace", async () => {
    const executor = stubExecutor({ exitCode: 2 }, async (request) => {
      await writeFile(join(request.workspace, "partial.ts"), "export const partial = 1;\n");
    });

    const output = await runAdapter({
      adapter: processAdapter(),
      input: taskboardInput(),
      workspace: await workspace(),
      executor,
      runId: FIXED_RUN_ID,
      now: FIXED_NOW,
    });

    expect(output.status).toBe("failed");
    expect(output.exitCode).toBe(2);
    expect(output.files.map((file) => file.path)).toContain("partial.ts");
  });

  it("requires an executor for a process adapter", async () => {
    await expect(
      runAdapter({
        adapter: processAdapter(),
        input: taskboardInput(),
        workspace: await workspace(),
      }),
    ).rejects.toBeInstanceOf(HarnessError);
  });
});

describe("run preconditions", () => {
  it("refuses a non-empty workspace", async () => {
    const dir = await workspace();
    await writeFile(join(dir, "stale.ts"), "stale", "utf8");

    await expect(
      runAdapter({
        adapter: createFakeAdapter(),
        input: taskboardInput(),
        workspace: dir,
      }),
    ).rejects.toMatchObject({ code: "workspace_not_empty" });
  });

  it("refuses a starting file that escapes the workspace", async () => {
    const input = taskboardInput();

    await expect(
      runAdapter({
        adapter: createFakeAdapter(),
        input: {
          ...input,
          startingFiles: [{ path: "../escape.ts", content: "export {};" }],
        },
        workspace: await workspace(),
      }),
    ).rejects.toMatchObject({ code: "invalid_run_input" });
  });
});

describe("adapter registry", () => {
  it("exposes the baseline and the real harness adapters", () => {
    expect(adapterSummaries().map((adapter) => adapter.id)).toEqual([
      "fake",
      "claude-code-openrouter",
      "codex-openrouter",
      "aider-openrouter",
    ]);
    expect(getAdapter("fake").kind).toBe("baseline");
  });

  it("rejects an unknown adapter id", () => {
    expect(() => getAdapter("missing")).toThrow(HarnessError);
  });
});

describe("workspace cleanup", () => {
  it("refuses to remove a shared directory", async () => {
    await expect(removeRunWorkspace("/tmp")).rejects.toMatchObject({
      code: "invalid_workspace",
    });
  });
});
