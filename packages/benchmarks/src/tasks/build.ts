import {
  parseSpec,
  type Requirement,
} from "@orivoxx/core";

import {
  RulesetSchema,
  TaskDefinitionSchema,
  type Ruleset,
  type TaskDefinition,
  type TaskManifest,
  type TaskRequirement,
} from "../contracts/task.js";
import type { ScoringConfig } from "../contracts/scoring.js";
import { fingerprintRuleset } from "../fingerprint.js";

export type TaskDefinitionErrorCode =
  | "invalid_spec"
  | "semantic_requirement"
  | "missing_bench"
  | "unknown_bench"
  | "invalid_definition"
  | "spec_content_mismatch";

export class TaskDefinitionError extends Error {
  readonly code: TaskDefinitionErrorCode;
  readonly detail?: string;

  constructor(code: TaskDefinitionErrorCode, message: string, detail?: string) {
    super(message);
    this.name = "TaskDefinitionError";
    this.code = code;
    this.detail = detail;
  }
}

export interface BuildTaskDefinitionInput {
  manifest: TaskManifest;
  specText: string;
  scoringConfig: ScoringConfig;
}

function toTaskRequirement(
  requirement: Requirement,
  bench: "spec" | "security",
): TaskRequirement {
  return {
    id: requirement.id,
    title: requirement.title,
    description: requirement.description,
    severity: requirement.severity,
    bench,
    checks: requirement.checks,
  };
}

export function buildRuleset(
  manifest: TaskManifest,
  requirements: TaskRequirement[],
): Ruleset {
  const sorted = [...requirements].sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );
  const fingerprint = fingerprintRuleset(
    sorted.map((requirement) => ({
      id: requirement.id,
      title: requirement.title,
      description: requirement.description,
      severity: requirement.severity,
      bench: requirement.bench,
      checks: requirement.checks,
    })),
  );

  return RulesetSchema.parse({
    schemaVersion: "1.0.0",
    id: manifest.id,
    version: manifest.rulesetVersion,
    taskId: manifest.id,
    requirements: sorted,
    fingerprint,
  });
}

export function buildTaskDefinition(
  input: BuildTaskDefinitionInput,
): TaskDefinition {
  const parsed = parseSpec(input.specText);

  if (!parsed.ok) {
    throw new TaskDefinitionError(
      "invalid_spec",
      `Task ${input.manifest.id} has an invalid spec: ${parsed.error.message}`,
      `line ${parsed.error.line}`,
    );
  }

  for (const requirement of parsed.requirements) {
    if (requirement.verificationMode !== "deterministic") {
      throw new TaskDefinitionError(
        "semantic_requirement",
        `Requirement ${requirement.id} is ${requirement.verificationMode}; benchmark scoring only accepts deterministic requirements.`,
      );
    }
  }

  const specFile = input.manifest.startingFiles.find(
    (file) => file.path === input.manifest.specPath,
  );

  if (specFile === undefined || specFile.content !== input.specText) {
    throw new TaskDefinitionError(
      "spec_content_mismatch",
      "The starting PROJECT_SPEC.md must contain the exact specText.",
    );
  }

  const benchMap = input.manifest.requirementBenches;
  const requirementIds = new Set(parsed.requirements.map((requirement) => requirement.id));

  for (const requirement of parsed.requirements) {
    if (benchMap[requirement.id] === undefined) {
      throw new TaskDefinitionError(
        "missing_bench",
        `Requirement ${requirement.id} has no bench assignment.`,
      );
    }
  }

  for (const requirementId of Object.keys(benchMap)) {
    if (!requirementIds.has(requirementId)) {
      throw new TaskDefinitionError(
        "unknown_bench",
        `Bench assignment references unknown requirement ${requirementId}.`,
      );
    }
  }

  const requirements = parsed.requirements.map((requirement) =>
    toTaskRequirement(requirement, benchMap[requirement.id] ?? "spec"),
  );
  const ruleset = buildRuleset(input.manifest, requirements);

  const candidate = {
    manifest: input.manifest,
    specText: input.specText,
    ruleset,
    scoringConfig: input.scoringConfig,
  };
  const validated = TaskDefinitionSchema.safeParse(candidate);

  if (!validated.success) {
    throw new TaskDefinitionError(
      "invalid_definition",
      `Task ${input.manifest.id} failed validation.`,
      validated.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
    );
  }

  return validated.data;
}
