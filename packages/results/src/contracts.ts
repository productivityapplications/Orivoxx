import { z } from "zod";

import {
  CapReasonSchema,
  ScoreResultSchema,
  SemverSchema,
  type ScoreResult,
} from "@orivoxx/benchmarks";
import {
  AttributionSchema,
  ChaosMetadataSchema,
  RunMetricsSchema,
  TraceSchema,
} from "@orivoxx/core";

export const RESULT_SCHEMA_VERSION = "1.0.0" as const;
export const SEED_SCHEMA_VERSION = "1.0.0" as const;

/**
 * Hard ceilings for a stored result. Full source, archives, prompts, and model
 * responses are never stored; the produced-code diff is bounded text.
 */
export const RESULT_LIMITS = {
  maxDiffBytes: 262_144,
  maxDiffFiles: 200,
  maxUnverifiedIds: 200,
  maxRequirementIds: 200,
  maxResultsPerRead: 200,
  defaultResultsPerRead: 50,
} as const;

export const ResultIdSchema = z
  .string()
  .regex(/^res_[a-z0-9]{10,40}$/, "Result id must look like res_<id>.");
export type ResultId = z.infer<typeof ResultIdSchema>;

export const TaskIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,63}$/, "Task id must be lowercase kebab-case.");

export const AdapterIdentitySchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
    version: SemverSchema,
    label: z.string().min(1).max(120),
    kind: z.enum(["baseline", "harness"]),
  })
  .strict();
export type AdapterIdentity = z.infer<typeof AdapterIdentitySchema>;

export const ModelIdentitySchema = z
  .object({
    provider: z.string().min(1).max(64),
    name: z.string().min(1).max(200),
    baseUrl: z.url().max(2048).nullable(),
  })
  .strict();
export type ModelIdentity = z.infer<typeof ModelIdentitySchema>;

export const RunOutcomeSchema = z.enum(["completed", "failed", "timeout"]);
export type RunOutcome = z.infer<typeof RunOutcomeSchema>;

export const TestRunSchema = z
  .object({
    command: z.string().min(1).max(500),
    exitCode: z.number().int().min(0).max(255).nullable(),
    timedOut: z.boolean(),
    durationMs: z.number().int().nonnegative(),
    passed: z.boolean(),
    outputSummary: z.string().max(8_192),
  })
  .strict();
export type TestRun = z.infer<typeof TestRunSchema>;

export const RealTaskMetaSchema = z
  .object({
    repoUrl: z.string().url().max(2048),
    baseCommit: z.string().regex(/^[a-f0-9]{7,40}$/),
    language: z.enum(["python", "node"]),
    source: z.enum(["handpicked", "community", "private"]),
    visibility: z.enum(["curated", "community", "private"]),
    license: z.string().min(1).max(64),
  })
  .strict();
export type RealTaskMeta = z.infer<typeof RealTaskMetaSchema>;

export const RunSummarySchema = z
  .object({
    status: RunOutcomeSchema,
    exitCode: z.number().int().min(0).max(255).nullable(),
    durationMs: z.number().int().nonnegative(),
  })
  .strict();
export type RunSummary = z.infer<typeof RunSummarySchema>;

export const BenchScoresSchema = z
  .object({
    spec: z.number().min(0).max(100),
    security: z.number().min(0).max(100),
    maintainability: z.number().min(0).max(100),
  })
  .strict();
export type BenchScores = z.infer<typeof BenchScoresSchema>;

export const RequirementTallySchema = z
  .object({
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    drifted: z.number().int().nonnegative(),
    unverified: z.number().int().nonnegative(),
  })
  .strict();
export type RequirementTally = z.infer<typeof RequirementTallySchema>;

export const DiffFileStatusSchema = z.enum(["added", "removed", "changed"]);
export type DiffFileStatus = z.infer<typeof DiffFileStatusSchema>;

export const DiffFileSchema = z
  .object({
    path: z.string().min(1).max(1024),
    status: DiffFileStatusSchema,
    addedLines: z.number().int().nonnegative(),
    removedLines: z.number().int().nonnegative(),
  })
  .strict();
export type DiffFile = z.infer<typeof DiffFileSchema>;

/**
 * The produced-code diff is text, never a full artifact. `truncated` says the
 * byte budget cut the hunks, which is visible rather than silently lossy.
 */
export const DiffSummarySchema = z
  .object({
    text: z.string().max(RESULT_LIMITS.maxDiffBytes),
    truncated: z.boolean(),
    addedFiles: z.number().int().nonnegative(),
    removedFiles: z.number().int().nonnegative(),
    changedFiles: z.number().int().nonnegative(),
    totalAddedLines: z.number().int().nonnegative(),
    totalRemovedLines: z.number().int().nonnegative(),
    files: z.array(DiffFileSchema).max(RESULT_LIMITS.maxDiffFiles),
  })
  .strict();
export type DiffSummary = z.infer<typeof DiffSummarySchema>;

const LeaderboardFields = {
  resultId: ResultIdSchema,
  createdAt: z.iso.datetime({ offset: true }),
  taskId: TaskIdSchema,
  taskVersion: SemverSchema,
  rulesetVersion: SemverSchema,
  scoringConfigVersion: SemverSchema,
  adapterVersion: SemverSchema,
  repositoryFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  adapter: AdapterIdentitySchema,
  model: ModelIdentitySchema.nullable(),
  run: RunSummarySchema,
  overall: z.number().min(0).max(100),
  benches: BenchScoresSchema,
  capsApplied: z.array(CapReasonSchema).max(2),
  appliedCap: z.number().min(0).max(100).nullable(),
  tally: RequirementTallySchema,
  metrics: RunMetricsSchema.optional(),
  chaos: ChaosMetadataSchema.optional(),
  attribution: AttributionSchema.nullable().optional(),
  attributionReason: z.string().max(300).nullable().optional(),
  taskSuccess: z.boolean().optional(),
  test: TestRunSchema.optional(),
  realTask: RealTaskMetaSchema.optional(),
} as const;

export const LeaderboardEntrySchema = z.object(LeaderboardFields).strict();
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const BenchmarkResultSchema = z
  .object({
    schemaVersion: z.literal(RESULT_SCHEMA_VERSION),
    ...LeaderboardFields,
    score: ScoreResultSchema,
    diff: DiffSummarySchema,
    trace: TraceSchema.optional(),
    traceTruncated: z.boolean().optional(),
    metrics: RunMetricsSchema.optional(),
    chaos: ChaosMetadataSchema.optional(),
    attribution: AttributionSchema.nullable().optional(),
    attributionReason: z.string().max(300).nullable().optional(),
    taskSuccess: z.boolean().optional(),
    test: TestRunSchema.optional(),
    realTask: RealTaskMetaSchema.optional(),
  })
  .strict()
  .superRefine((result, context) => {
    const addIssue = (path: string, message: string) =>
      context.addIssue({ code: "custom", path: [path], message });

    if (result.score.overall !== result.overall) {
      addIssue("overall", "Overall score must match the embedded scorecard.");
    }

    if (result.score.benches.spec.score !== result.benches.spec) {
      addIssue("benches.spec", "Spec bench must match the embedded scorecard.");
    }

    if (result.score.benches.security.score !== result.benches.security) {
      addIssue("benches.security", "Security bench must match the embedded scorecard.");
    }

    if (result.score.benches.maintainability.score !== result.benches.maintainability) {
      addIssue(
        "benches.maintainability",
        "Maintainability bench must match the embedded scorecard.",
      );
    }

    if (result.score.taskId !== result.taskId) {
      addIssue("taskId", "Task id must match the embedded scorecard.");
    }

    for (const field of [
      "taskVersion",
      "rulesetVersion",
      "scoringConfigVersion",
      "adapterVersion",
      "repositoryFingerprint",
    ] as const) {
      if (result.score[field] !== result[field]) {
        addIssue(field, `${field} must match the embedded scorecard.`);
      }
    }

    if (
      result.score.capsApplied.length !== result.capsApplied.length ||
      result.score.capsApplied.some((cap, index) => cap !== result.capsApplied[index])
    ) {
      addIssue("capsApplied", "Caps must match the embedded scorecard.");
    }

    if (result.score.appliedCap !== result.appliedCap) {
      addIssue("appliedCap", "Applied cap must match the embedded scorecard.");
    }

    const tally = tallyRequirements(result.score);

    if (
      tally.passed !== result.tally.passed ||
      tally.failed !== result.tally.failed ||
      tally.drifted !== result.tally.drifted ||
      tally.unverified !== result.tally.unverified
    ) {
      addIssue("tally", "Requirement tally must match the embedded scorecard.");
    }

    const statuses = new Map(
      result.score.requirements.map((requirement) => [requirement.id, requirement.status]),
    );
    const expectedUnverified = result.score.requirements
      .filter((requirement) => requirement.status === "UNVERIFIED")
      .map((requirement) => requirement.id);

    if (expectedUnverified.length !== result.score.unverifiedRequirementIds.length) {
      addIssue(
        "score.unverifiedRequirementIds",
        "Unverified ids must match the unverified requirements.",
      );
    }

    for (const id of result.score.unverifiedRequirementIds) {
      if (!statuses.has(id)) {
        addIssue("score.unverifiedRequirementIds", `Unknown requirement ${id}.`);
      }
    }

    if (result.run.status === "completed" && result.run.exitCode !== 0) {
      addIssue("run.exitCode", "A completed run must exit 0.");
    }

    if (result.run.status === "timeout" && result.run.exitCode !== null) {
      addIssue("run.exitCode", "A timed-out run must not report an exit code.");
    }
  });
export type BenchmarkResult = z.infer<typeof BenchmarkResultSchema>;

export function tallyRequirements(score: ScoreResult): RequirementTally {
  const tally: RequirementTally = { passed: 0, failed: 0, drifted: 0, unverified: 0 };

  for (const requirement of score.requirements) {
    switch (requirement.status) {
      case "PASS":
        tally.passed += 1;
        break;
      case "FAIL":
        tally.failed += 1;
        break;
      case "DRIFT":
        tally.drifted += 1;
        break;
      case "UNVERIFIED":
        tally.unverified += 1;
        break;
    }
  }

  return tally;
}

export function deriveBenches(score: ScoreResult): BenchScores {
  return {
    spec: score.benches.spec.score,
    security: score.benches.security.score,
    maintainability: score.benches.maintainability.score,
  };
}

/**
 * Denormalizes the sortable leaderboard fields from the scorecard. Keeping one
 * source of truth means a row can never advertise a score the scorecard does
 * not contain.
 */
export function toLeaderboardEntry(result: BenchmarkResult): LeaderboardEntry {
  return LeaderboardEntrySchema.parse({
    resultId: result.resultId,
    createdAt: result.createdAt,
    taskId: result.taskId,
    taskVersion: result.taskVersion,
    rulesetVersion: result.rulesetVersion,
    scoringConfigVersion: result.scoringConfigVersion,
    adapterVersion: result.adapterVersion,
    repositoryFingerprint: result.repositoryFingerprint,
    adapter: result.adapter,
    model: result.model,
    run: result.run,
    overall: result.overall,
    benches: result.benches,
    capsApplied: result.capsApplied,
    appliedCap: result.appliedCap,
    tally: result.tally,
    ...(result.metrics === undefined ? {} : { metrics: result.metrics }),
    ...(result.chaos === undefined ? {} : { chaos: result.chaos }),
    ...(result.attribution === undefined ? {} : { attribution: result.attribution }),
    ...(result.attributionReason === undefined
      ? {}
      : { attributionReason: result.attributionReason }),
    ...(result.taskSuccess === undefined ? {} : { taskSuccess: result.taskSuccess }),
    ...(result.test === undefined ? {} : { test: result.test }),
    ...(result.realTask === undefined ? {} : { realTask: result.realTask }),
  });
}

export interface BuildBenchmarkResultInput {
  resultId: string;
  createdAt: string;
  adapter: AdapterIdentity;
  model: ModelIdentity | null;
  run: RunSummary;
  score: ScoreResult;
  diff: DiffSummary;
  trace?: BenchmarkResult["trace"];
  traceTruncated?: boolean;
  metrics?: BenchmarkResult["metrics"];
  chaos?: BenchmarkResult["chaos"];
  attribution?: BenchmarkResult["attribution"];
  attributionReason?: string | null;
  taskSuccess?: boolean;
  test?: BenchmarkResult["test"];
  realTask?: BenchmarkResult["realTask"];
}

export function buildBenchmarkResult(
  input: BuildBenchmarkResultInput,
): BenchmarkResult {
  return BenchmarkResultSchema.parse({
    schemaVersion: RESULT_SCHEMA_VERSION,
    resultId: input.resultId,
    createdAt: input.createdAt,
    taskId: input.score.taskId,
    taskVersion: input.score.taskVersion,
    rulesetVersion: input.score.rulesetVersion,
    scoringConfigVersion: input.score.scoringConfigVersion,
    adapterVersion: input.score.adapterVersion,
    repositoryFingerprint: input.score.repositoryFingerprint,
    adapter: input.adapter,
    model: input.model,
    run: input.run,
    overall: input.score.overall,
    benches: deriveBenches(input.score),
    capsApplied: input.score.capsApplied,
    appliedCap: input.score.appliedCap,
    tally: tallyRequirements(input.score),
    score: input.score,
    diff: input.diff,
    ...(input.trace === undefined ? {} : { trace: input.trace }),
    ...(input.traceTruncated === undefined ? {} : { traceTruncated: input.traceTruncated }),
    ...(input.metrics === undefined ? {} : { metrics: input.metrics }),
    ...(input.chaos === undefined ? {} : { chaos: input.chaos }),
    ...(input.attribution === undefined ? {} : { attribution: input.attribution }),
    ...(input.attributionReason === undefined
      ? {}
      : { attributionReason: input.attributionReason }),
    ...(input.taskSuccess === undefined ? {} : { taskSuccess: input.taskSuccess }),
    ...(input.test === undefined ? {} : { test: input.test }),
    ...(input.realTask === undefined ? {} : { realTask: input.realTask }),
  });
}
