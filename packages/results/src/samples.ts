import {
  evaluateRepository,
  getTask,
  getTaskFixtures,
  normalizeProjectFiles,
  type ScoreResult,
} from "@orivoxx/benchmarks";

import {
  buildBenchmarkResult,
  type BenchmarkResult,
  type DiffSummary,
} from "./contracts.js";

export type SampleVariant = "compliant" | "regressed";

const EMPTY_DIFF: DiffSummary = {
  text: "",
  truncated: false,
  addedFiles: 0,
  removedFiles: 0,
  changedFiles: 0,
  totalAddedLines: 0,
  totalRemovedLines: 0,
  files: [],
};

const scoreCache = new Map<string, ScoreResult>();

/**
 * A real deterministic evaluation of a checked-in fixture. Used by store tests
 * and by the seed generator; the adapter is the `fake` baseline, so a sample
 * row can never be mistaken for a model result.
 */
export function sampleScore(taskId: string, variant: SampleVariant): ScoreResult {
  const cacheKey = `${taskId}@${variant}`;
  const cached = scoreCache.get(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const task = getTask(taskId);
  const fixtures = getTaskFixtures(taskId);

  if (fixtures === undefined) {
    throw new Error(`Unknown benchmark task ${taskId}.`);
  }

  const score = evaluateRepository({
    task,
    files: normalizeProjectFiles(fixtures[variant]),
    adapterVersion: "1.0.0",
  }).score;

  scoreCache.set(cacheKey, score);

  return score;
}

export interface SampleResultOptions {
  taskId?: string;
  variant?: SampleVariant;
  resultId: string;
  createdAt: string;
  diff?: DiffSummary;
}

export function sampleResult(options: SampleResultOptions): BenchmarkResult {
  const taskId = options.taskId ?? "taskboard";
  const variant = options.variant ?? "compliant";
  const score = sampleScore(taskId, variant);

  return buildBenchmarkResult({
    resultId: options.resultId,
    createdAt: options.createdAt,
    adapter: {
      id: "fake",
      version: "1.0.0",
      label: `Fake fixture (${taskId}/${variant})`,
      kind: "baseline",
    },
    model: null,
    run: { status: "completed", exitCode: 0, durationMs: 1_000 },
    score,
    diff: options.diff ?? EMPTY_DIFF,
  });
}
