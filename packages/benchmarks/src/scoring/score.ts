import type { RequirementStatus } from "@orivoxx/core";

import {
  ScoreResultSchema,
  type BenchScore,
  type CapReason,
  type ScoreRequirement,
  type ScoreResult,
  type ScoredBench,
  type StructuralMetrics,
} from "../contracts/score.js";
import { SemverSchema } from "../contracts/scoring.js";
import {
  TaskDefinitionSchema,
  type TaskDefinition,
} from "../contracts/task.js";
import { round1 } from "./round.js";
import { scoreStructuralMetrics } from "./structural.js";

export type ScoreErrorCode =
  | "invalid_task"
  | "unknown_requirement"
  | "duplicate_requirement"
  | "empty_bench"
  | "invalid_adapter_version"
  | "invalid_fingerprint"
  | "invalid_result";

export class ScoreError extends Error {
  readonly code: ScoreErrorCode;
  readonly detail?: string;

  constructor(code: ScoreErrorCode, message: string, detail?: string) {
    super(message);
    this.name = "ScoreError";
    this.code = code;
    this.detail = detail;
  }
}

export interface ScoreOutcome {
  requirementId: string;
  status: RequirementStatus;
}

export interface ScoreRunInput {
  task: TaskDefinition;
  outcomes: readonly ScoreOutcome[];
  metrics: StructuralMetrics;
  adapterVersion: string;
  repositoryFingerprint: string;
  structuralWarnings?: readonly string[];
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function summarizeBench(
  requirements: readonly ScoreRequirement[],
  bench: ScoredBench,
): BenchScore {
  const scoped = requirements.filter((requirement) => requirement.bench === bench);

  if (scoped.length === 0) {
    throw new ScoreError("empty_bench", `The ${bench} bench has no requirements.`);
  }

  let totalWeight = 0;
  let earnedWeight = 0;
  let passed = 0;
  let failed = 0;
  let drifted = 0;
  let unverified = 0;

  for (const requirement of scoped) {
    totalWeight += requirement.weight;
    earnedWeight += requirement.earned;

    switch (requirement.status) {
      case "PASS":
        passed += 1;
        break;
      case "FAIL":
        failed += 1;
        break;
      case "DRIFT":
        drifted += 1;
        break;
      case "UNVERIFIED":
        unverified += 1;
        break;
    }
  }

  if (totalWeight <= 0) {
    throw new ScoreError("empty_bench", `The ${bench} bench has zero total weight.`);
  }

  return {
    score: round1((100 * earnedWeight) / totalWeight),
    earnedWeight,
    totalWeight,
    passed,
    failed,
    drifted,
    unverified,
  };
}

function hasCriticalFailure(
  requirements: readonly ScoreRequirement[],
  bench: ScoredBench,
): boolean {
  return requirements.some(
    (requirement) =>
      requirement.bench === bench &&
      requirement.severity === "critical" &&
      (requirement.status === "FAIL" || requirement.status === "DRIFT"),
  );
}

function parseTask(task: TaskDefinition): TaskDefinition {
  const parsed = TaskDefinitionSchema.safeParse(task);

  if (!parsed.success) {
    throw new ScoreError(
      "invalid_task",
      "The benchmark task definition is invalid.",
      parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
    );
  }

  return parsed.data;
}

function parseAdapterVersion(adapterVersion: string): string {
  const parsed = SemverSchema.safeParse(adapterVersion);

  if (!parsed.success) {
    throw new ScoreError(
      "invalid_adapter_version",
      "The adapter version must be a semantic version.",
      adapterVersion,
    );
  }

  return parsed.data;
}

function parseFingerprint(fingerprint: string): string {
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) {
    throw new ScoreError(
      "invalid_fingerprint",
      "The repository fingerprint must be a SHA-256 hex digest.",
      fingerprint,
    );
  }

  return fingerprint;
}

export function scoreRun(input: ScoreRunInput): ScoreResult {
  const task = parseTask(input.task);
  const adapterVersion = parseAdapterVersion(input.adapterVersion);
  const repositoryFingerprint = parseFingerprint(input.repositoryFingerprint);
  const config = task.scoringConfig;
  const requirementIds = new Set(
    task.ruleset.requirements.map((requirement) => requirement.id),
  );
  const statusById = new Map<string, RequirementStatus>();

  for (const outcome of input.outcomes) {
    if (!requirementIds.has(outcome.requirementId)) {
      throw new ScoreError(
        "unknown_requirement",
        `Unknown requirement ${outcome.requirementId}.`,
      );
    }

    if (statusById.has(outcome.requirementId)) {
      throw new ScoreError(
        "duplicate_requirement",
        `Duplicate outcome for ${outcome.requirementId}.`,
      );
    }

    statusById.set(outcome.requirementId, outcome.status);
  }

  const requirements: ScoreRequirement[] = [...task.ruleset.requirements]
    .sort((left, right) => compareStrings(left.id, right.id))
    .map((requirement) => {
      const status = statusById.get(requirement.id) ?? "UNVERIFIED";
      const weight = config.severityWeights[requirement.severity];

      return {
        id: requirement.id,
        bench: requirement.bench,
        severity: requirement.severity,
        status,
        weight,
        earned: status === "PASS" ? weight : 0,
      };
    });

  const spec = summarizeBench(requirements, "spec");
  const security = summarizeBench(requirements, "security");
  const maintainability = scoreStructuralMetrics(
    input.metrics,
    config.structural,
    input.structuralWarnings ?? [],
  );

  const capsApplied: CapReason[] = [];
  let appliedCap: number | null = null;

  if (hasCriticalFailure(requirements, "spec")) {
    capsApplied.push("critical-spec-failure");
    appliedCap = config.caps.criticalSpec;
  }

  if (hasCriticalFailure(requirements, "security")) {
    capsApplied.push("critical-security-failure");
    appliedCap =
      appliedCap === null
        ? config.caps.criticalSecurity
        : Math.min(appliedCap, config.caps.criticalSecurity);
  }

  let overall = round1(
    config.benchWeights.spec * spec.score +
      config.benchWeights.security * security.score +
      config.benchWeights.maintainability * maintainability.score,
  );

  if (appliedCap !== null && overall > appliedCap) {
    overall = appliedCap;
  }

  const result = {
    schemaVersion: "1.0.0" as const,
    taskId: task.manifest.id,
    taskVersion: task.manifest.version,
    rulesetVersion: task.ruleset.version,
    scoringConfigVersion: config.version,
    adapterVersion,
    repositoryFingerprint,
    overall,
    benches: { spec, security, maintainability },
    requirements,
    capsApplied,
    appliedCap,
    unverifiedRequirementIds: requirements
      .filter((requirement) => requirement.status === "UNVERIFIED")
      .map((requirement) => requirement.id),
  };
  const parsed = ScoreResultSchema.safeParse(result);

  if (!parsed.success) {
    throw new ScoreError(
      "invalid_result",
      "The score result failed validation.",
      parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
    );
  }

  return parsed.data;
}
