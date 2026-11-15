import {
  buildCheckContext,
  computeRepositoryFingerprint,
  runChecks,
  type NormalizedFile,
  type Requirement,
  type RequirementStatus,
} from "@orivoxx/core";

import type { TaskDefinition } from "../contracts/task.js";
import type { ScoreResult } from "../contracts/score.js";
import { scoreRun } from "./score.js";
import { analyzeStructure } from "./structural.js";

export interface EvaluateRepositoryInput {
  task: TaskDefinition;
  files: readonly NormalizedFile[];
  adapterVersion: string;
  repositoryFingerprint?: string;
}

export interface RepositoryEvaluation {
  score: ScoreResult;
  outcomes: { requirementId: string; status: RequirementStatus }[];
  warnings: string[];
}

function toCoreRequirement(requirement: TaskDefinition["ruleset"]["requirements"][number]): Requirement {
  return {
    id: requirement.id,
    title: requirement.title,
    description: requirement.description,
    severity: requirement.severity,
    verificationMode: "deterministic",
    checks: requirement.checks,
  };
}

/**
 * Deterministic evaluation entry point. It parses and checks the produced
 * repository statically and never runs produced code, tests, builds, installs,
 * or shell commands. No provider or adapter module is imported here.
 */
export function evaluateRepository(
  input: EvaluateRepositoryInput,
): RepositoryEvaluation {
  const requirements = input.task.ruleset.requirements.map(toCoreRequirement);
  const files = [...input.files];
  const checkResults = runChecks(requirements, buildCheckContext(files));
  const outcomes = input.task.ruleset.requirements.map((requirement) => ({
    requirementId: requirement.id,
    status: (checkResults.get(requirement.id)?.status ?? "UNVERIFIED") as RequirementStatus,
  }));
  const analysis = analyzeStructure(files);
  const score = scoreRun({
    task: input.task,
    outcomes,
    metrics: analysis.metrics,
    adapterVersion: input.adapterVersion,
    repositoryFingerprint:
      input.repositoryFingerprint ?? computeRepositoryFingerprint(files),
    structuralWarnings: analysis.warnings,
  });

  return { score, outcomes, warnings: analysis.warnings };
}
