import type { TaskDefinition } from "@orivoxx/benchmarks";
import { evaluateRepository, type RepositoryEvaluation } from "@orivoxx/benchmarks";
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
import { buildAdapterRunInput, runAdapter } from "./run.js";

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
}

export interface BenchmarkRun {
  run: AdapterRunOutput;
  evaluation: RepositoryEvaluation;
  result: BenchmarkResult;
}

/**
 * The organizer-run pipeline: execute the adapter in the sandbox, capture the
 * produced repository, score it statically, and build the immutable result
 * record. The score path consumes only captured text.
 */
export async function runBenchmark(
  options: RunBenchmarkOptions,
): Promise<BenchmarkRun> {
  const input = options.input ?? buildAdapterRunInput(options.task);
  const run = await runAdapter({
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
  });

  return { run, evaluation, result };
}
