import type {
  Assessment,
  Evidence,
  Finding,
  Gate,
  ReportSummary,
  Requirement,
  RequirementResult,
  RunState,
} from "../contracts/index.js";
import type { CheckOutcome } from "../checks/types.js";

export interface VerdictInput {
  requirements: Requirement[];
  checkResults: Map<string, CheckOutcome>;
  assessments: Assessment[];
  requirementToEvidenceIds: Map<string, string[]>;
  evidence: Evidence[];
}

export interface VerdictOutput {
  requirementResults: RequirementResult[];
  findings: Finding[];
  summary: ReportSummary;
  gate: Gate;
  runState: RunState;
  unmappedFindings: Finding[];
}
