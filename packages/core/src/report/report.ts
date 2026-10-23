import {
  VerificationReportSchema,
  type Evidence,
  type Finding,
  type Gate,
  type ModelMeta,
  type ReportSummary,
  type Requirement,
  type RequirementResult,
  type RunState,
  type VerificationReport,
} from "../contracts/index.js";

export interface BuildReportInput {
  projectName: string;
  snapshotFingerprint: string;
  requirements: Requirement[];
  requirementResults: RequirementResult[];
  findings: Finding[];
  evidence: Evidence[];
  warnings: string[];
  gate: Gate;
  runState: RunState;
  summary: ReportSummary;
  model: ModelMeta;
  now?: Date;
}

export class ReportValidationError extends Error {
  readonly code = "invalid_report";
  readonly fieldPath: string;

  constructor(fieldPath: string, detail: string) {
    super(`Verification report validation failed at "${fieldPath}": ${detail}`);
    this.name = "ReportValidationError";
    this.fieldPath = fieldPath;
  }
}

export function formatRunId(snapshotFingerprint: string, now: Date): string {
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");

  return `${snapshotFingerprint.slice(0, 12)}-${timestamp}`;
}

function throwValidationError(
  issues: readonly { path: PropertyKey[]; message: string }[],
): never {
  const firstIssue = issues[0];
  const fieldPath =
    firstIssue !== undefined && firstIssue.path.length > 0
      ? firstIssue.path.map(String).join(".")
      : "<root>";

  throw new ReportValidationError(
    fieldPath,
    firstIssue?.message ?? "Unknown schema validation failure.",
  );
}

export function buildReport(input: BuildReportInput): VerificationReport {
  const requirementIds = new Set(
    input.requirements.map((requirement) => requirement.id),
  );
  const resultIds = new Set(
    input.requirementResults.map((result) => result.requirementId),
  );

  for (const requirementId of requirementIds) {
    if (!resultIds.has(requirementId)) {
      throw new ReportValidationError(
        "requirements",
        `Missing requirement result for "${requirementId}".`,
      );
    }
  }

  for (const requirementId of resultIds) {
    if (!requirementIds.has(requirementId)) {
      throw new ReportValidationError(
        "requirements",
        `Unknown requirement result "${requirementId}".`,
      );
    }
  }

  const now = input.now ?? new Date();
  const candidate = {
    schemaVersion: "1.0.0" as const,
    runId: formatRunId(input.snapshotFingerprint, now),
    projectName: input.projectName,
    createdAt: now.toISOString(),
    snapshotFingerprint: input.snapshotFingerprint,
    runState: input.runState,
    gate: input.gate,
    summary: input.summary,
    requirements: input.requirementResults,
    findings: input.findings,
    evidence: input.evidence,
    warnings: input.warnings,
    graph: { nodes: [], edges: [], coverageWarnings: [] },
    model: input.model,
  };
  const parsed = VerificationReportSchema.safeParse(candidate);

  if (!parsed.success) {
    throwValidationError(parsed.error.issues);
  }

  return parsed.data;
}
