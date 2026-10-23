import type {
  Evidence,
  Finding,
  Gate,
  ReportSummary,
  Requirement,
  RequirementResult,
  RequirementStatus,
  RunState,
  Severity,
} from "../contracts/index.js";
import { compareEvidenceIds } from "../evidence/evidence.js";
import type { CheckOutcome } from "../checks/types.js";
import type { VerdictInput, VerdictOutput } from "./types.js";

interface RequirementEvaluation {
  requirement: Requirement;
  status: RequirementStatus;
  reason: string;
  origin: "deterministic" | "semantic";
  missingAssessment: boolean;
  evidenceIds: string[];
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function checkFailureReason(outcome: CheckOutcome): string {
  const firstEvidence = outcome.evidence[0];

  return firstEvidence?.summary ?? "Deterministic check failed.";
}

function evidenceIdsFor(
  input: VerdictInput,
  requirementId: string,
  validEvidenceIds: Set<string>,
): string[] {
  const ids = input.requirementToEvidenceIds.get(requirementId) ?? [];
  const validIds = ids.filter((id) => validEvidenceIds.has(id));

  return [...new Set(validIds)].sort(compareEvidenceIds);
}

function mergeEvidenceIds(
  deterministicIds: string[],
  assessmentIds: readonly string[] | undefined,
  validEvidenceIds: Set<string>,
): string[] {
  const merged = new Set(deterministicIds);

  for (const id of assessmentIds ?? []) {
    if (validEvidenceIds.has(id)) {
      merged.add(id);
    }
  }

  return [...merged].sort(compareEvidenceIds);
}

function evaluateRequirement(
  requirement: Requirement,
  input: VerdictInput,
  validEvidenceIds: Set<string>,
  evidenceIds: string[],
): RequirementEvaluation {
  const checkOutcome = input.checkResults.get(requirement.id);
  const hasChecks = requirement.checks.length > 0;

  // R1: a deterministic FAIL is final. Assessments are never consulted.
  if (hasChecks && checkOutcome?.status === "FAIL") {
    return {
      requirement,
      status: "FAIL",
      reason: checkFailureReason(checkOutcome),
      origin: "deterministic",
      missingAssessment: false,
      evidenceIds,
    };
  }

  // R2: deterministic mode with no machine-checkable rule cannot pass.
  if (!hasChecks && requirement.verificationMode === "deterministic") {
    return {
      requirement,
      status: "UNVERIFIED",
      reason: "No checks declared for a deterministic requirement.",
      origin: "deterministic",
      missingAssessment: false,
      evidenceIds,
    };
  }

  // A declared check without a result is an operational failure, never a PASS.
  if (hasChecks && checkOutcome === undefined) {
    return {
      requirement,
      status: "UNVERIFIED",
      reason: "Deterministic check result unavailable.",
      origin: "deterministic",
      missingAssessment: false,
      evidenceIds,
    };
  }

  // R3 / R5: semantic verification requires a valid assessment even when all
  // deterministic checks passed. A passing text marker is necessary but not
  // sufficient for a semantic requirement.
  if (requirement.verificationMode === "semantic") {
    const assessment = input.assessments.find(
      (candidate) => candidate.requirementId === requirement.id,
    );

    if (assessment === undefined) {
      return {
        requirement,
        status: "UNVERIFIED",
        reason: "No semantic assessment available.",
        origin: "deterministic",
        missingAssessment: true,
        evidenceIds,
      };
    }

    const mergedEvidenceIds = mergeEvidenceIds(
      evidenceIds,
      assessment.evidenceRefIds,
      validEvidenceIds,
    );

    if (assessment.status === "INCONCLUSIVE") {
      return {
        requirement,
        status: "UNVERIFIED",
        reason: "Semantic assessment was inconclusive.",
        origin: "semantic",
        missingAssessment: false,
        evidenceIds: mergedEvidenceIds,
      };
    }

    const hasValidReference = assessment.evidenceRefIds.some((id) =>
      validEvidenceIds.has(id),
    );

    if (!hasValidReference) {
      return {
        requirement,
        status: "UNVERIFIED",
        reason: "Semantic assessment evidence references were invalid.",
        origin: "semantic",
        missingAssessment: false,
        evidenceIds: mergedEvidenceIds,
      };
    }

    if (assessment.status === "PASS") {
      return {
        requirement,
        status: "PASS",
        reason: "",
        origin: "semantic",
        missingAssessment: false,
        evidenceIds: mergedEvidenceIds,
      };
    }

    return {
      requirement,
      status: "FAIL",
      reason: assessment.rationale,
      origin: "semantic",
      missingAssessment: false,
      evidenceIds: mergedEvidenceIds,
    };
  }

  // R4: all declared deterministic checks passed.
  if (checkOutcome?.status === "PASS") {
    return {
      requirement,
      status: "PASS",
      reason: "",
      origin: "deterministic",
      missingAssessment: false,
      evidenceIds,
    };
  }

  return {
    requirement,
    status: "UNVERIFIED",
    reason: "Deterministic check result unavailable.",
    origin: "deterministic",
    missingAssessment: false,
    evidenceIds,
  };
}

function findingSummary(
  status: RequirementStatus,
  reason: string,
  origin: "deterministic" | "semantic",
): string {
  if (status === "FAIL") {
    return origin === "semantic"
      ? "Semantic assessment failed."
      : `Deterministic check failed: ${reason}`;
  }

  if (status === "DRIFT") {
    return "Implementation drifts from the specification.";
  }

  return "Requirement not fully verified.";
}

function computeGate(evaluations: RequirementEvaluation[]): Gate {
  const isUnresolved = (evaluation: RequirementEvaluation): boolean =>
    evaluation.status !== "PASS";

  const hasBlockingIssue = evaluations.some(
    (evaluation) =>
      (evaluation.requirement.severity === "critical" ||
        evaluation.requirement.severity === "high") &&
      isUnresolved(evaluation),
  );

  if (hasBlockingIssue) {
    return "BLOCKED";
  }

  const hasWarning = evaluations.some(
    (evaluation) =>
      (evaluation.requirement.severity === "medium" ||
        evaluation.requirement.severity === "low") &&
      isUnresolved(evaluation),
  );

  return hasWarning ? "WARN" : "PASS";
}

export function aggregate(input: VerdictInput): VerdictOutput {
  // The precedence rules here are the security boundary of Orivoxx. Model output
  // (Phase 4) can NEVER overturn a deterministic FAIL. Any future change to these
  // rules requires architecture approval.
  const evidenceById = new Map(input.evidence.map((record) => [record.id, record]));
  const validEvidenceIds = new Set(evidenceById.keys());
  const evaluations: RequirementEvaluation[] = input.requirements.map((requirement) =>
    evaluateRequirement(
      requirement,
      input,
      validEvidenceIds,
      evidenceIdsFor(input, requirement.id, validEvidenceIds),
    ),
  );

  const findingCandidates = evaluations
    .filter((evaluation) => evaluation.status !== "PASS")
    .map((evaluation, order) => ({ evaluation, order }));

  findingCandidates.sort((left, right) => {
    const byRequirement = compareStrings(
      left.evaluation.requirement.id,
      right.evaluation.requirement.id,
    );

    if (byRequirement !== 0) {
      return byRequirement;
    }

    const bySeverity =
      SEVERITY_RANK[left.evaluation.requirement.severity] -
      SEVERITY_RANK[right.evaluation.requirement.severity];

    if (bySeverity !== 0) {
      return bySeverity;
    }

    return left.order - right.order;
  });

  const findings: Finding[] = [];
  const findingIdByRequirement = new Map<string, string>();

  for (let index = 0; index < findingCandidates.length; index += 1) {
    const candidate = findingCandidates[index];

    if (candidate === undefined) {
      continue;
    }

    const evaluation = candidate.evaluation;
    const id = `FND-${String(index + 1).padStart(3, "0")}`;
    const firstEvidence = evaluation.evidenceIds
      .map((evidenceId) => evidenceById.get(evidenceId))
      .find((record): record is Evidence => record !== undefined);

    const finding: Finding = {
      id,
      requirementId: evaluation.requirement.id,
      status: evaluation.status,
      severity: evaluation.requirement.severity,
      summary: findingSummary(evaluation.status, evaluation.reason, evaluation.origin),
      reason:
        evaluation.reason.length > 0
          ? evaluation.reason
          : "Requirement not fully verified.",
      evidenceIds: evaluation.evidenceIds,
      origin: evaluation.origin,
      ...(firstEvidence?.path === undefined ? {} : { path: firstEvidence.path }),
      ...(firstEvidence?.startLine === undefined
        ? {}
        : { startLine: firstEvidence.startLine }),
      ...(firstEvidence?.endLine === undefined ? {} : { endLine: firstEvidence.endLine }),
    };

    findings.push(finding);

    if (!findingIdByRequirement.has(evaluation.requirement.id)) {
      findingIdByRequirement.set(evaluation.requirement.id, id);
    }
  }

  const requirementResults: RequirementResult[] = evaluations.map((evaluation) => {
    if (evaluation.status === "PASS") {
      return {
        requirementId: evaluation.requirement.id,
        status: "PASS",
        findingIds: [],
        evidenceIds: evaluation.evidenceIds,
      };
    }

    const findingId = findingIdByRequirement.get(evaluation.requirement.id);

    return {
      requirementId: evaluation.requirement.id,
      status: evaluation.status,
      findingIds: findingId === undefined ? [] : [findingId],
      evidenceIds: evaluation.evidenceIds,
    };
  });

  const summary: ReportSummary = {
    totalRequirements: input.requirements.length,
    pass: evaluations.filter((evaluation) => evaluation.status === "PASS").length,
    fail: evaluations.filter((evaluation) => evaluation.status === "FAIL").length,
    drift: evaluations.filter((evaluation) => evaluation.status === "DRIFT").length,
    unverified: evaluations.filter((evaluation) => evaluation.status === "UNVERIFIED")
      .length,
  };

  const hasDeterministicResults = input.checkResults.size > 0;
  const hasMissingAssessment = evaluations.some(
    (evaluation) => evaluation.missingAssessment,
  );
  const runState: RunState =
    hasMissingAssessment && hasDeterministicResults ? "PARTIAL" : "COMPLETE";

  return {
    requirementResults,
    findings,
    summary,
    gate: computeGate(evaluations),
    runState,
    unmappedFindings: findings.filter((finding) => finding.path === undefined),
  };
}
