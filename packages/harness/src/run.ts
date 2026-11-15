import { randomUUID } from "node:crypto";

import type { TaskDefinition } from "@orivoxx/benchmarks";
import { redactSecrets } from "@orivoxx/core";

import {
  AdapterRunInputSchema,
  AdapterRunOutputSchema,
  AgentCommandSchema,
  HARNESS_LIMITS,
  type AdapterModel,
  type AdapterRunInput,
  type AdapterRunOutput,
  type AgentAdapter,
  type AgentExecutor,
  type RunStatus,
} from "./contracts.js";
import { captureWorkspace, type CaptureOptions } from "./capture.js";
import { HarnessError } from "./errors.js";
import {
  assertEmptyDirectory,
  writeProjectFiles,
} from "./workspace.js";

const ANSI_ESCAPE_PATTERN = /\u001b\[[0-9;?]*[A-Za-z]/g;

function summarizeStream(raw: string): string {
  const clean = raw.replace(ANSI_ESCAPE_PATTERN, "").replace(/\r\n?/g, "\n");
  const redacted = redactSecrets(clean).content;

  if (redacted.length <= HARNESS_LIMITS.maxSummaryChars) {
    return redacted;
  }

  return `${redacted.slice(0, HARNESS_LIMITS.maxSummaryChars)}[truncated]`;
}

export interface RunAdapterOptions {
  adapter: AgentAdapter;
  input: AdapterRunInput;
  workspace: string;
  executor?: AgentExecutor;
  capture?: CaptureOptions;
  runId?: string;
  now?: () => Date;
}

function parseInput(input: AdapterRunInput): AdapterRunInput {
  const parsed = AdapterRunInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new HarnessError(
      "invalid_run_input",
      "The adapter run input is invalid.",
      parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
    );
  }

  return parsed.data;
}

function parseOutput(output: unknown): AdapterRunOutput {
  const parsed = AdapterRunOutputSchema.safeParse(output);

  if (!parsed.success) {
    throw new HarnessError(
      "invalid_run_output",
      "The adapter run output failed validation.",
      parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
    );
  }

  return parsed.data;
}

export async function runAdapter(options: RunAdapterOptions): Promise<AdapterRunOutput> {
  const input = parseInput(options.input);
  const now = options.now ?? (() => new Date());
  const runId = options.runId ?? randomUUID();

  await assertEmptyDirectory(options.workspace);
  await writeProjectFiles(options.workspace, input.startingFiles);

  const plan = options.adapter.plan(input);
  const startedAt = now();
  const startedMs = Date.now();
  let exitCode: number | null = 0;
  let timedOut = false;
  let durationMs = 0;
  let stdout = "";
  let stderr = "";

  if (plan.kind === "materialize") {
    await writeProjectFiles(options.workspace, plan.files, { overwrite: true });
    durationMs = Date.now() - startedMs;
  } else {
    const executor = options.executor;

    if (executor === undefined) {
      throw new HarnessError(
        "executor_required",
        `Adapter "${options.adapter.id}" requires an executor.`,
      );
    }

    const command = AgentCommandSchema.parse(plan.command);
    const result = await executor.execute({
      command,
      workspace: options.workspace,
      timeoutMs: input.limits.timeLimitSeconds * 1000,
      maxOutputBytes: input.limits.maxOutputBytes,
    });

    exitCode = result.exitCode;
    timedOut = result.timedOut;
    durationMs = result.durationMs;
    stdout = result.stdout;
    stderr = result.stderr;

    if (timedOut) {
      exitCode = null;
    }
  }

  const captured = await captureWorkspace(options.workspace, options.capture);
  const completedAt = now();
  const status: RunStatus = timedOut
    ? "timeout"
    : exitCode === 0
      ? "completed"
      : "failed";

  return parseOutput({
    schemaVersion: "1.0.0",
    runId,
    status,
    adapter: {
      id: options.adapter.id,
      version: options.adapter.version,
      label: options.adapter.label,
      kind: options.adapter.kind,
    },
    model: options.adapter.model,
    task: input.task,
    exitCode,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs,
    stdoutSummary: summarizeStream(stdout),
    stderrSummary: summarizeStream(stderr),
    warnings: captured.warnings,
    repositoryFingerprint: captured.repositoryFingerprint,
    files: captured.files,
    stats: captured.stats,
  });
}

export interface BuildRunInputOptions {
  model?: AdapterModel | null;
  limits?: Partial<AdapterRunInput["limits"]>;
}

export function buildAdapterRunInput(
  task: TaskDefinition,
  options: BuildRunInputOptions = {},
): AdapterRunInput {
  const manifest = task.manifest;

  return AdapterRunInputSchema.parse({
    schemaVersion: "1.0.0",
    task: {
      id: manifest.id,
      version: manifest.version,
      rulesetVersion: manifest.rulesetVersion,
      scoringConfigVersion: manifest.scoringConfigVersion,
    },
    startingFiles: manifest.startingFiles,
    limits: {
      timeLimitSeconds: manifest.timeLimitSeconds,
      maxSteps: manifest.maxSteps,
      maxOutputBytes: manifest.maxOutputBytes,
      ...options.limits,
    },
    network: manifest.network,
    model: options.model ?? null,
  });
}
