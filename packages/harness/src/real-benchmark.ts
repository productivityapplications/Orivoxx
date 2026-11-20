import {
  scoreRealTask,
  normalizeProjectFiles,
  type RealTask,
} from "@orivoxx/benchmarks";
import { attributeRun } from "@orivoxx/attribution";
import {
  CounterfactualOutcomeSchema,
  deriveRunMetrics,
  type AttributionProof,
  type ChaosMetadata,
  type CounterfactualOutcome,
} from "@orivoxx/core";
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
import {
  AgentCommandSchema,
  HARNESS_LIMITS,
  type AdapterRunInput,
  type AdapterRunOutput,
  type AgentExecutor,
  type AgentAdapter,
  type ReplayAction,
} from "./contracts.js";
import { HarnessError } from "./errors.js";
import { parseTestCommand } from "./test-command.js";
import {
  createRunWorkspace,
  removeRunWorkspace,
  writeProjectFiles,
} from "./workspace.js";

const PACKAGE_PROXY = "http://model-proxy:8080";

const CHAOS_LABELS: Record<string, string> = {
  tool_error: "Injected tool error",
  failing_tools: "Injected failing tools",
  latency: "Injected latency",
  context_pressure: "Truncated context",
};

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
  /** Label override, e.g. `python (chaos: failing_tools)`. */
  adapterLabel?: string;
  chaos?: AdapterRunInput["chaos"];
}

export interface RealBenchmarkRun {
  run: AdapterRunOutput;
  cloned: ClonedRepository;
  input: AdapterRunInput;
  actions: ReplayAction[];
  result: BenchmarkResult;
}

function chaosMetadata(input: AdapterRunInput): ChaosMetadata | undefined {
  if (input.chaos === "none") return undefined;

  return {
    kind: input.chaos,
    label: CHAOS_LABELS[input.chaos] ?? `Injected ${input.chaos}`,
    payloadSummary: `deterministic ${input.chaos} injection`,
  };
}

async function installDependencies(
  executor: AgentExecutor,
  workspace: string,
  installCommands: readonly string[],
): Promise<void> {
  for (const installCommand of installCommands) {
    const parsed = parseTestCommand(installCommand);
    await executor.execute({
      command: AgentCommandSchema.parse({
        ...parsed,
        env: {
          HTTPS_PROXY: PACKAGE_PROXY,
          HTTP_PROXY: PACKAGE_PROXY,
          PIP_DISABLE_PIP_VERSION_CHECK: "1",
          NPM_CONFIG_AUDIT: "false",
          NPM_CONFIG_FUND: "false",
        },
      }),
      workspace,
      timeoutMs: 300_000,
      maxOutputBytes: 1_048_576,
    });
  }
}

export interface RealReplayOptions {
  task: RealTask;
  startingFiles: AdapterRunInput["startingFiles"];
  actions: readonly ReplayAction[];
  divergenceStep: number;
  executor: AgentExecutor;
  passThreshold?: number;
}

/**
 * Counterfactual replay for a real repository task. It reconstructs the
 * workspace from the recorded starting files and actions, applies the
 * intercepted action at `divergenceStep`, and re-runs the real test command in
 * the sandbox. No model call and no host execution are involved.
 */
export async function replayRealTask(
  options: RealReplayOptions,
): Promise<CounterfactualOutcome> {
  const workspace = await createRunWorkspace();

  try {
    await writeProjectFiles(workspace, options.startingFiles);
    await installDependencies(
      options.executor,
      workspace,
      options.task.installCommand === undefined ? [] : [options.task.installCommand],
    );

    const files = new Map(options.startingFiles.map((file) => [file.path, file.content] as const));
    let replayedSteps = 0;

    for (const action of [...options.actions].sort(
      (left, right) => left.stepIndex - right.stepIndex,
    )) {
      if (action.stepIndex < options.divergenceStep) {
        continue;
      }

      files.set(action.path, action.content);
      replayedSteps += 1;
    }

    for (const testFile of options.task.testFiles ?? []) {
      files.set(testFile.path, testFile.content);
    }

    await writeProjectFiles(
      workspace,
      [...files.entries()].map(([path, content]) => ({ path, content })),
      { overwrite: true },
    );

    const test = await options.executor.execute({
      command: parseTestCommand(options.task.testCommand),
      workspace,
      timeoutMs: 600_000,
      maxOutputBytes: Math.min(HARNESS_LIMITS.maxAggregateBytes, 1_048_576),
    });
    const passed = !test.timedOut && test.exitCode === 0;

    return CounterfactualOutcomeSchema.parse({
      overall: passed ? 100 : 0,
      passed,
      exitReason: passed ? "completed" : "failed",
      divergenceStep: options.divergenceStep,
      replayedSteps,
      passThreshold: options.passThreshold ?? 70,
      sufficient: passed,
    });
  } finally {
    await removeRunWorkspace(workspace).catch(() => undefined);
  }
}

/**
 * Real-repository pipeline: clone at base commit on the host, run the brand
 * agent and its test command in the same sandbox, capture the patch, score the
 * primary test result and quality flags, attribute failures, and prove an
 * attributed tool failure by re-running the real test after the intervention.
 */
export async function runRealTaskBenchmark(
  options: RealBenchmarkOptions,
): Promise<RealBenchmarkRun> {
  const cloned = options.clone ?? (await cloneTaskRepository(options.task));
  const input = buildRealRunInput(options.task, cloned.files, options.adapter, {
    timeLimitSeconds: 900,
    maxSteps: 40,
    chaos: options.chaos ?? "none",
  });
  const { output: run, actions } = await runAdapterDetailed({
    adapter: options.adapter,
    input,
    workspace: options.workspace,
    executor: options.executor,
    runId: options.runId,
    now: options.now,
    testCommand: options.task.testCommand,
    testFiles: options.task.testFiles,
    installCommands:
      options.task.installCommand === undefined ? [] : [options.task.installCommand],
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

  let attribution = attributionOutcome.attribution;

  if (
    attribution !== null &&
    attribution.proof === null &&
    trace !== undefined &&
    actions.length > 0
  ) {
    const failed = trace.find(
      (event) => event.type === "tool_call_finished" && event.status !== "ok",
    );

    if (failed?.type === "tool_call_finished") {
      try {
        const counterfactual = await replayRealTask({
          task: options.task,
          startingFiles: input.startingFiles,
          actions,
          divergenceStep: failed.stepIndex,
          executor: options.executor,
          passThreshold: options.passThreshold ?? 70,
        });
        const proof: AttributionProof = {
          baseline: {
            overall: score.overall,
            passed: false,
            exitReason: run.status === "timeout" ? "timeout" : "failed",
          },
          intervention: {
            kind: "retry_policy",
            stepIndex: failed.stepIndex,
            summary: `retry the intercepted ${failed.toolName} once at step ${failed.stepIndex}`,
          },
          counterfactual,
        };
        attribution = { ...attribution, proof };
      } catch {
        // A replay that cannot run leaves the proof absent rather than invented.
      }
    }
  }

  const chaos = chaosMetadata(input);
  const result = buildBenchmarkResult({
    resultId: options.resultId ?? createResultId(),
    createdAt: run.completedAt,
    adapter: {
      id: run.adapter.id,
      version: run.adapter.version,
      label: options.adapterLabel ?? run.adapter.label,
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
    ...(chaos === undefined ? {} : { chaos }),
    attribution,
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

/** Exposed for the replay script and tests. */
export { installDependencies, PACKAGE_PROXY, HarnessError };
