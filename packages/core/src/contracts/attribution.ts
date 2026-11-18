import { z } from "zod";

import { ChaosKindSchema, ExitReasonSchema } from "./observability.js";

export const AttributionLayerSchema = z.enum([
  "spec",
  "model",
  "harness",
  "tool",
  "environment",
]);
export type AttributionLayer = z.infer<typeof AttributionLayerSchema>;

export const AttributionModeSchema = z.enum([
  "decision",
  "execution",
  "recovery",
  "detection",
]);
export type AttributionMode = z.infer<typeof AttributionModeSchema>;

export const AttributionConfidenceSchema = z.enum(["high", "medium"]);
export const AttributionStatusSchema = z.enum(["attributed", "unattributed", "unavailable"]);

export const AttributionEvidenceSchema = z
  .object({
    stepIndex: z.number().int().min(1).max(500).nullable(),
    kind: z.enum([
      "tool_error",
      "tool_result",
      "model_call",
      "check",
      "exit",
      "contradiction",
      "nondeterminism",
      "spec",
    ]),
    detail: z.string().min(1).max(500),
  })
  .strict();
export type AttributionEvidence = z.infer<typeof AttributionEvidenceSchema>;

export const InterventionSchema = z
  .object({
    kind: z.enum(["retry_policy", "stop_policy", "action_replacement", "none"]),
    stepIndex: z.number().int().min(1).max(500),
    summary: z.string().min(1).max(300),
  })
  .strict();
export type Intervention = z.infer<typeof InterventionSchema>;

export const CounterfactualOutcomeSchema = z
  .object({
    overall: z.number().min(0).max(100),
    passed: z.boolean(),
    exitReason: ExitReasonSchema,
    divergenceStep: z.number().int().min(1).max(500),
    replayedSteps: z.number().int().nonnegative(),
    passThreshold: z.number().min(0).max(100),
    sufficient: z.boolean(),
  })
  .strict();
export type CounterfactualOutcome = z.infer<typeof CounterfactualOutcomeSchema>;

export const AttributionProofSchema = z
  .object({
    baseline: z
      .object({
        overall: z.number().min(0).max(100),
        passed: z.boolean(),
        exitReason: ExitReasonSchema,
      })
      .strict(),
    intervention: InterventionSchema,
    counterfactual: CounterfactualOutcomeSchema,
  })
  .strict();
export type AttributionProof = z.infer<typeof AttributionProofSchema>;

export const AttributionCandidateSchema = z
  .object({
    intervention: InterventionSchema,
    counterfactual: CounterfactualOutcomeSchema,
  })
  .strict();
export type AttributionCandidate = z.infer<typeof AttributionCandidateSchema>;

export const AttributionSchema = z
  .object({
    layer: AttributionLayerSchema,
    mode: AttributionModeSchema,
    ruleId: z.string().min(1).max(64),
    confidence: AttributionConfidenceSchema,
    evidence: z.array(AttributionEvidenceSchema).min(1).max(12),
    proof: AttributionProofSchema.nullable(),
    candidates: z.array(AttributionCandidateSchema).max(6).default([]),
  })
  .strict();
export type Attribution = z.infer<typeof AttributionSchema>;

export const AttributionResultSchema = z
  .object({
    status: AttributionStatusSchema,
    attribution: AttributionSchema.nullable(),
    reason: z.string().min(1).max(300).nullable(),
  })
  .strict();
export type AttributionResult = z.infer<typeof AttributionResultSchema>;

export const ChaosMetadataSchema = z
  .object({
    kind: ChaosKindSchema,
    label: z.string().min(1).max(80),
    payloadSummary: z.string().max(300),
  })
  .strict();
export type ChaosMetadata = z.infer<typeof ChaosMetadataSchema>;

export const ReliabilityProfileSchema = z
  .object({
    runs: z.number().int().nonnegative(),
    artifactScoreMean: z.number().min(0).max(100),
    artifactScoreStd: z.number().nonnegative(),
    passAtK: z.number().min(0).max(1),
    passThreshold: z.number().min(0).max(100),
    layerDistribution: z.record(AttributionLayerSchema, z.number().int().nonnegative()),
    chaosSensitivity: z
      .object({
        none: z.number().min(0).max(1).optional(),
        tool_error: z.number().min(0).max(1).optional(),
        latency: z.number().min(0).max(1).optional(),
        context_pressure: z.number().min(0).max(1).optional(),
      })
      .strict(),
    trend: z.number(),
  })
  .strict();
export type ReliabilityProfile = z.infer<typeof ReliabilityProfileSchema>;

export const ATTRIBUTION_LAYERS = AttributionLayerSchema.options;
export const ATTRIBUTION_MODES = AttributionModeSchema.options;

export function attributionCell(layer: AttributionLayer, mode: AttributionMode): string {
  return `${layer} × ${mode}`;
}

export const ReplayActionSchema = z
  .object({
    stepIndex: z.number().int().min(1).max(500),
    toolName: z.string().min(1).max(64),
    path: z.string().min(1).max(1024),
    content: z.string().max(307_200),
  })
  .strict();
export type ReplayAction = z.infer<typeof ReplayActionSchema>;
