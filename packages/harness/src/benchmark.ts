import type { TaskDefinition } from "@orivoxx/benchmarks";
import { evaluateRepository, type RepositoryEvaluation } from "@orivoxx/benchmarks";
import {
  RunFinishedEventSchema,
  RunStartedEventSchema,
  deriveRunMetrics,
  type ChaosKind,
  type ChaosMetadata,
  type ExitReason,
  type TraceEvent,
} from "@orivoxx/core";
import { attributeRun } from "@orivoxx/attribution";
import { replay } from "@orivoxx/replay";
import {
  buildBenchmarkResult,
  createResultId,
  type BenchmarkResult,
} from "@orivoxx/results";

import { toNormalizedFiles, type CaptureOptions } from "./capture.js";
import {
  type AdapterRunInput,
  type AdapterRunOutput,
  type AgentAdapter,
  type AgentExecutor,
} from "./contracts.js";
import { buildProducedDiff, type ProducedDiffOptions } from "./diff.js";
import { buildAdapterRunInput, runAdapterDetailed } from "./run.js";

export const DEFAULT_PASS_THRESHOLD = 70;

const CHAOS_LABELS: Record<ChaosKind, string> = {
  none: "No chaos",
  tool_error: "Injected tool error",
  latency: "Injected model latency",
  context_pressure: "Truncated context",
};

export interface RunBenchmarkOptions {
  task: TaskDefinition;
  adapter: AgentAdapter;
  workspace: string;
  executor?: AgentExecutor;
  input?: AdapterRunInput;
  capture?: CaptureOptions;
  diff?: ProducedDiffOptions;
  resultId?: string;
  runId?: string;
  now?: () => Date;
  runIndex?: number;
  passThreshold?: number;
}

export interface BenchmarkRun {
  run: AdapterRunOutput;
  evaluation: RepositoryEvaluation;
  result: BenchmarkResult;
}

function exitReasonOf(run: AdapterRunOutput): ExitReason {
  switch (run.status) {
    case "completed":
      return "completed";
    case "timeout":
      return "timeout";
    case "failed":
      return "failed";
    default:
      return "error";
  }
}

export function envelopeTrace(
  input: AdapterRunInput,
  run: AdapterRunOutput,
  runIndex: number,
  rawTrace: readonly TraceEvent[] | undefined,
): TraceEvent[] | undefined {
  if (rawTrace === undefined || rawTrace.length === 0) {
    return undefined;
  }

  const exitReason = exitReasonOf(run);
  const steps = new Set(
    rawTrace
      .filter(
        (event) =>
          event.type === "step_completed" ||
          event.type === "tool_call_finished" ||
          event.type === "model_call_finished",
      )
      .map((event) => event.stepIndex),
  ).size;
  const toolCalls = rawTrace.filter((event) => event.type === "tool_call_finished").length;
  const promptTokens = rawTrace.reduce(
    (sum, event) =>
      sum + (event.type === "model_call_finished" ? event.promptTokens : 0),
    0,
  );
  const completionTokens = rawTrace.reduce(
    (sum, event) =>
      sum + (event.type === "model_call_finished" ? event.completionTokens : 0),
    0,
  );
  const costUsd = rawTrace.reduce(
    (sum, event) => sum + (event.type === "model_call_finished" ? event.costUsd : 0),
    0,
  );

  return [
    RunStartedEventSchema.parse({
      type: "run_started",
      at: run.startedAt,
      runId: run.runId,
      adapter: { id: run.adapter.id, version: run.adapter.version },
      taskVersion: input.task.version,
      rulesetVersion: input.task.rulesetVersion,
      scoringConfigVersion: input.task.scoringConfigVersion,
      model:
        run.model === null
          ? null
          : { provider: run.model.provider, name: run.model.name },
      startTime: run.startedAt,
      runIndex,
    }),
    ...rawTrace.filter(
      (event) => event.type !== "run_started" && event.type !== "run_finished",
    ),
    RunFinishedEventSchema.parse({
      type: "run_finished",
      at: run.completedAt,
      endTime: run.completedAt,
      exitReason,
      totals: {
        steps,
        toolCalls,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        costUsd,
        durationMs: run.durationMs,
      },
    }),
  ];
}

/**
 * Organizer-run pipeline: execute, capture, score, collect the trace, then
 * attribute a failure and attach a counterfactual proof when one exists.
 */
export async function runBenchmark(
  options: RunBenchmarkOptions,
): Promise<BenchmarkRun> {
  const input = options.input ?? buildAdapterRunInput(options.task);
  const runIndex = options.runIndex ?? 0;
  const passThreshold = options.passThreshold ?? DEFAULT_PASS_THRESHOLD;
  const { output: run, actions } = await runAdapterDetailed({
    adapter: options.adapter,
    input,
    workspace: options.workspace,
    executor: options.executor,
    capture: options.capture,
    runId: options.runId,
    now: options.now,
  });
  const evaluation = evaluateRepository({
    task: options.task,
    files: toNormalizedFiles(run.files),
    adapterVersion: options.adapter.version,
    repositoryFingerprint: run.repositoryFingerprint,
  });
  const diff = buildProducedDiff(input.startingFiles, run.files, options.diff);
  const trace = envelopeTrace(input, run, runIndex, run.trace);
  const metrics = trace === undefined ? undefined : deriveRunMetrics(trace);
  const chaosKind = input.chaos;
  const chaos: ChaosMetadata | undefined =
    chaosKind === "none"
      ? undefined
      : {
          kind: chaosKind,
          label: CHAOS_LABELS[chaosKind],
          payloadSummary: `deterministic ${chaosKind} injection`,
        };

  let attribution: BenchmarkResult["attribution"] = null;
  let attributionReason: string | null = null;

  if (trace === undefined) {
    attributionReason = "trace_unavailable";
  } else {
    const outcome = attributeRun({
      trace,
      score: evaluation.score,
      task: options.task,
      chaos,
      passThreshold,
    });

    if (outcome.attribution === null) {
      attributionReason = outcome.reason ?? "not attributable";
    } else {
      const failedStep = trace.find(
        (event) => event.type === "tool_call_finished" && event.status !== "ok",
      );

      if (failedStep?.type === "tool_call_finished") {
        const intervention = {
          kind: "retry_policy" as const,
          stepIndex: failedStep.stepIndex,
          summary: `retry the failed ${failedStep.toolName} once at step ${failedStep.stepIndex}`,
        };
        const baselineExitReason = exitReasonOf(run);
        const proof = replay({
          task: options.task,
          actions,
          baseline: {
            overall: evaluation.score.overall,
            exitReason: baselineExitReason,
          },
          failedSteps: [failedStep.stepIndex],
          intervention,
          passThreshold,
          adapterVersion: options.adapter.version,
        });

        attribution = {
          ...outcome.attribution,
          confidence: proof.outcome.sufficient ? "high" : "medium",
          proof: proof.outcome.sufficient
            ? {
                baseline: {
                  overall: evaluation.score.overall,
                  passed: evaluation.score.overall >= passThreshold,
                  exitReason: baselineExitReason,
                },
                intervention,
                counterfactual: proof.outcome,
              }
            : null,
          candidates: [{ intervention, counterfactual: proof.outcome }],
        };
      } else {
        attribution = outcome.attribution;
      }
    }
  }

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
    score: evaluation.score,
    diff,
    ...(trace === undefined ? {} : { trace, traceTruncated: run.traceTruncated ?? false }),
    ...(metrics === undefined ? {} : { metrics }),
    ...(chaos === undefined ? {} : { chaos }),
    attribution,
    attributionReason,
  });

  return { run, evaluation, result };
}
