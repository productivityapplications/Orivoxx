import {
  scoreRealTask,
  normalizeProjectFiles,
  type RealTask,
} from "@orivoxx/benchmarks";
import { attributeRun } from "@orivoxx/attribution";
import { deriveRunMetrics } from "@orivoxx/core";
import {
  buildBenchmarkResult,
  createResultId,
  type BenchmarkResult,
} from "@orivoxx/results";

import { envelopeTrace } from "./benchmark.js";
import { buildProducedDiff } from "./diff.js";
import { runAdapterDetailed } from "./run.js";
import {
  buildRealRunInput,
  cloneTaskRepository,
  cleanupClone,
  type ClonedRepository,
} from "./real-task.js";
import type {
  AdapterRunInput,
  AdapterRunOutput,
  AgentAdapter,
  AgentExecutor,
  ReplayAction,
} from "./contracts.js";

export interface RealBenchmarkOptions {
  task: RealTask;
  adapter: AgentAdapter;
  workspace: string;
  executor: AgentExecutor;
  resultId?: string;
  runId?: string;
  now?: () => Date;
  clone?: ClonedRepository;
  passThreshold?: number;
}

export interface RealBenchmarkRun {
  run: AdapterRunOutput;
  cloned: ClonedRepository;
  input: AdapterRunInput;
  actions: ReplayAction[];
  result: BenchmarkResult;
}

/**
 * Real-repository pipeline: clone at base commit on the host, run the brand
 * agent and its test command in the same sandbox, capture the patch, score the
 * primary test result and quality flags, and attribute failures.
 */
export async function runRealTaskBenchmark(
  options: RealBenchmarkOptions,
): Promise<RealBenchmarkRun> {
  const cloned = options.clone ?? (await cloneTaskRepository(options.task));
  const input = buildRealRunInput(options.task, cloned.files, options.adapter);
  const { output: run, actions } = await runAdapterDetailed({
    adapter: options.adapter,
    input,
    workspace: options.workspace,
    executor: options.executor,
    runId: options.runId,
    now: options.now,
    testCommand: options.task.testCommand,
  });
  const normalized = normalizeProjectFiles(normalizeFiles(run));
  const test = run.test;
  const taskSuccess = test?.passed === true;
  const score = scoreRealTask({
    taskId: options.task.id,
    taskVersion: options.task.version,
    adapterVersion: options.adapter.version,
    repositoryFingerprint: run.repositoryFingerprint,
    testPassed: taskSuccess,
    testExitCode: test?.exitCode ?? -1,
    files: normalized,
  });
  const trace = envelopeTrace(input, run, 0, run.trace);
  const metrics = trace === undefined ? undefined : deriveRunMetrics(trace);
  const diff = buildProducedDiff(input.startingFiles, run.files);

  const attributionOutcome = trace === undefined
    ? { status: "unavailable" as const, attribution: null, reason: "trace_unavailable" }
    : attributeRun({
        trace,
        score,
        task: {
          manifest: {
            id: options.task.id,
            version: options.task.version,
            title: options.task.title,
            summary: options.task.summary,
            difficulty: options.task.difficulty,
            tags: [],
            specPath: "PROJECT_SPEC.md",
            rulesetVersion: "1.0.0",
            scoringConfigVersion: "1.0.0",
            timeLimitSeconds: 900,
            maxSteps: 40,
            maxOutputBytes: 1_048_576,
            network: "model-proxy",
            startingFiles: input.startingFiles,
            requirementBenches: { "REQ-TEST-001": "spec" },
          },
          specText: options.task.issueText,
          ruleset: {
            schemaVersion: "1.0.0",
            id: options.task.id,
            version: "1.0.0",
            taskId: options.task.id,
            requirements: [],
            fingerprint: "0".repeat(64),
          },
          scoringConfig: {
            schemaVersion: "1.0.0",
            version: "1.0.0",
            benchWeights: { spec: 0.6, security: 0.25, maintainability: 0.15 },
            severityWeights: { critical: 8, high: 4, medium: 2, low: 1 },
            caps: { criticalSpec: 59.9, criticalSecurity: 49.9 },
            structural: {
              cycles: { good: 0, warn: 1 },
              maxFanOut: { good: 8, warn: 12 },
              orphanRatio: { good: 0.1, warn: 0.25 },
              moduleCount: { min: 3, max: 60 },
            },
          },
        } as never,
        test: test === undefined ? undefined : {
          command: test.command,
          passed: test.passed,
          timedOut: test.timedOut,
          exitCode: test.exitCode,
        },
        requiresTest: true,
        passThreshold: options.passThreshold ?? 70,
      });

  const result = buildBenchmarkResult({
    resultId: options.resultId ?? createResultId(),
    createdAt: run.completedAt,
    adapter: {
      id: run.adapter.id,
      version: run.adapter.version,
      label: run.adapter.label,
      kind: run.adapter.kind,
    },
    model: run.model,
    run: {
      status: run.status === "invalid" ? "failed" : run.status,
      exitCode: run.exitCode,
      durationMs: run.durationMs,
    },
    score,
    diff,
    ...(trace === undefined ? {} : { trace, traceTruncated: run.traceTruncated ?? false }),
    ...(metrics === undefined ? {} : { metrics }),
    attribution: attributionOutcome.attribution,
    attributionReason: attributionOutcome.reason,
    taskSuccess,
    ...(test === undefined ? {} : { test }),
    realTask: {
      repoUrl: options.task.repoUrl,
      baseCommit: options.task.baseCommit,
      language: options.task.language,
      source: options.task.source,
      visibility: options.task.visibility,
      license: options.task.license,
    },
  });

  return { run, cloned, input, actions, result };
}

function normalizeFiles(run: AdapterRunOutput) {
  return run.files.map((file) => ({ path: file.path, content: file.content }));
}

export async function disposeClone(cloned: ClonedRepository): Promise<void> {
  await cleanupClone(cloned.directory);
}
