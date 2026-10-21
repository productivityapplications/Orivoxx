import { z } from "zod";

export const SeveritySchema = z.enum(["critical", "high", "medium", "low"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const VerificationModeSchema = z.enum(["deterministic", "semantic"]);
export type VerificationMode = z.infer<typeof VerificationModeSchema>;

export const RequirementStatusSchema = z.enum(["PASS", "FAIL", "DRIFT", "UNVERIFIED"]);
export type RequirementStatus = z.infer<typeof RequirementStatusSchema>;

export const RunStateSchema = z.enum(["COMPLETE", "PARTIAL", "FAILED", "RATE_LIMITED"]);
export type RunState = z.infer<typeof RunStateSchema>;

export const GateSchema = z.enum(["PASS", "WARN", "BLOCKED"]);
export type Gate = z.infer<typeof GateSchema>;

export const EvidenceTypeSchema = z.enum([
  "file_presence",
  "file_absence",
  "text_marker",
  "dependency_state",
  "source_reference",
  "semantic_observation",
]);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

export const EvidenceOriginSchema = z.enum(["deterministic", "semantic"]);
export type EvidenceOrigin = z.infer<typeof EvidenceOriginSchema>;

export const AssessmentStatusSchema = z.enum(["PASS", "FAIL", "INCONCLUSIVE"]);
export type AssessmentStatus = z.infer<typeof AssessmentStatusSchema>;

export const ConfidenceSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const ExplanationDepthSchema = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
export type ExplanationDepth = z.infer<typeof ExplanationDepthSchema>;

export const SourceKindSchema = z.enum(["sample", "upload"]);
export type SourceKind = z.infer<typeof SourceKindSchema>;
