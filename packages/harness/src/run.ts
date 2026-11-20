import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import type { TaskDefinition } from "@orivoxx/benchmarks";
import {
  TRACE_LIMITS,
  TraceEventSchema,
  redactSecrets,
  type TraceEvent,
} from "@orivoxx/core";

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
  type ReplayAction,
  type RunStatus,
} from "./contracts.js";
import { captureWorkspace, type CaptureOptions } from "./capture.js";
import { HarnessError } from "./errors.js";
import { parseTestCommand } from "./test-command.js";
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

  return `${redacted.slice(0, HARNESS_LIMITS.maxSummaryChars - 12)}[truncated]`.slice(
    0,
    HARNESS_LIMITS.maxSummaryChars,
  );
}

const TRACE_DIRECTORY = ".orivoxx";
const MAX_ACTIONS = 120;
const MAX_ACTION_BYTES = 2 * 1024 * 1024;

async function readJsonLines(path: string): Promise<unknown[]> {
  let raw: string;

  try {
    raw = await readFile(path, "utf8");
  } catch {
    return [];
  }

  const rows: unknown[] = [];

  for (const line of raw.split("\n")) {
    if (line.trim().length === 0) {
      continue;
    }

    try {
      rows.push(JSON.parse(line));
    } catch {
      // Malformed lines are dropped; they never fail a scored run.
    }
  }

  return rows;
}

async function collectTrace(
  workspace: string,
  proxyEvents: readonly unknown[],
): Promise<{ trace: TraceEvent[]; truncated: boolean; warnings: string[] }> {
  const warnings: string[] = [];
  const events: TraceEvent[] = [];
  const agentRows = await readJsonLines(join(workspace, TRACE_DIRECTORY, "trace.jsonl"));

  for (const row of [...proxyEvents, ...agentRows]) {
    const parsed = TraceEventSchema.safeParse(row);

    if (parsed.success) {
      events.push(parsed.data);
    }
  }

  const priority = (event: TraceEvent): number => {
    switch (event.type) {
      case "run_started":
        return 0;
      case "model_call_started":
        return 1;
      case "model_call_finished":
        return 2;
      case "tool_call_started":
        return 3;
      case "tool_call_finished":
        return 4;
      case "step_completed":
        return 5;
      case "chaos_injected":
        return 6;
      case "run_finished":
        return 9;
    }
  };

  events.sort((left, right) => {
    const leftStep = "stepIndex" in left ? left.stepIndex : 0;
    const rightStep = "stepIndex" in right ? right.stepIndex : 0;

    if (leftStep !== rightStep) {
      return leftStep - rightStep;
    }

    return priority(left) - priority(right);
  });

  const unique: TraceEvent[] = [];
  const seen = new Set<string>();

  for (const event of events) {
    const key = JSON.stringify(event);

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(event);
    }
  }

  const truncated = unique.length > TRACE_LIMITS.maxEvents;
  const bounded = unique.slice(0, TRACE_LIMITS.maxEvents);

  if (truncated) {
    warnings.push("trace_truncated_events");
  }

  return { trace: bounded, truncated, warnings };
}

async function collectActions(workspace: string): Promise<ReplayAction[]> {
  const rows = await readJsonLines(join(workspace, TRACE_DIRECTORY, "actions.jsonl"));
  const actions: ReplayAction[] = [];
  let bytes = 0;

  for (const row of rows) {
    if (row === null || typeof row !== "object") {
      continue;
    }

    const record = row as Record<string, unknown>;
    const stepIndex = record.stepIndex;
    const toolName = record.toolName;
    const path = record.path;
    const content = record.content;

    if (
      typeof stepIndex !== "number" ||
      !Number.isInteger(stepIndex) ||
      stepIndex < 1 ||
      stepIndex > TRACE_LIMITS.maxEvents ||
      typeof toolName !== "string" ||
      toolName.length === 0 ||
      toolName.length > 64 ||
      typeof path !== "string" ||
      path.length === 0 ||
      path.length > 1024 ||
      typeof content !== "string" ||
      content.length > HARNESS_LIMITS.maxFileBytes ||
      path.startsWith("/") ||
      path.includes("..") ||
      path.includes("\\") ||
      path.includes("\0")
    ) {
      continue;
    }

    const actionBytes = Buffer.byteLength(content, "utf8");

    if (bytes + actionBytes > MAX_ACTION_BYTES || actions.length >= MAX_ACTIONS) {
      break;
    }

    actions.push({ stepIndex, toolName, path, content });
    bytes += actionBytes;
  }

  return actions;
}

async function removeTraceDirectory(workspace: string): Promise<void> {
  await rm(join(workspace, TRACE_DIRECTORY), { recursive: true, force: true }).catch(
    () => undefined,
  );
}

export interface RunAdapterDetails {
  output: AdapterRunOutput;
  actions: ReplayAction[];
}

export interface RunAdapterOptions {
  adapter: AgentAdapter;
  input: AdapterRunInput;
  workspace: string;
  executor?: AgentExecutor;
  capture?: CaptureOptions;
  runId?: string;
  now?: () => Date;
  testCommand?: string;
  testTimeoutMs?: number;
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

export async function runAdapterDetailed(
  options: RunAdapterOptions,
): Promise<RunAdapterDetails> {
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
  let proxyTrace: unknown[] = [];
  let test: AdapterRunOutput["test"];

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
    proxyTrace = result.trace ?? [];

    if (timedOut) {
      exitCode = null;
    }

    if (options.testCommand !== undefined && options.testCommand.length > 0) {
      const testCommand = parseTestCommand(options.testCommand);
      const testResult = await executor.execute({
        command: testCommand,
        workspace: options.workspace,
        timeoutMs: options.testTimeoutMs ?? 600_000,
        maxOutputBytes: Math.min(input.limits.maxOutputBytes, 1_048_576),
      });

      test = {
        command: options.testCommand,
        exitCode: testResult.timedOut ? null : testResult.exitCode,
        timedOut: testResult.timedOut,
        durationMs: testResult.durationMs,
        passed: !testResult.timedOut && testResult.exitCode === 0,
        outputSummary: summarizeStream(`${testResult.stdout}\n${testResult.stderr}`),
      };
    }
  }

  const collected = await collectTrace(options.workspace, proxyTrace);
  const actions = await collectActions(options.workspace);

  await removeTraceDirectory(options.workspace);

  const captured = await captureWorkspace(options.workspace, options.capture);
  const completedAt = now();
  const status: RunStatus = timedOut
    ? "timeout"
    : exitCode === 0
      ? "completed"
      : "failed";

  const output = parseOutput({
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
    warnings: [...captured.warnings, ...collected.warnings],
    repositoryFingerprint: captured.repositoryFingerprint,
    files: captured.files,
    stats: captured.stats,
    ...(collected.trace.length === 0 ? {} : { trace: collected.trace }),
    ...(collected.trace.length === 0 ? {} : { traceTruncated: collected.truncated }),
    ...(test === undefined ? {} : { test }),
  });

  return { output, actions };
}

export async function runAdapter(options: RunAdapterOptions): Promise<AdapterRunOutput> {
  return (await runAdapterDetailed(options)).output;
}

export interface BuildRunInputOptions {
  model?: AdapterModel | null;
  limits?: Partial<AdapterRunInput["limits"]>;
  chaos?: AdapterRunInput["chaos"];
}

export function buildAdapterRunInput(
  task: TaskDefinition,
  options: BuildRunInputOptions = {},
): AdapterRunInput {
  const manifest = task.manifest;

  return AdapterRunInputSchema.parse({
    schemaVersion: "1.0.0",
    chaos: options.chaos ?? "none",
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
