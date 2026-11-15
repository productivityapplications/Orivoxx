import { z } from "zod";

import {
  RequirementIdSchema,
  RequirementStatusSchema,
  SeveritySchema,
} from "@orivoxx/core";

import { SemverSchema } from "./scoring.js";

export const ScoredBenchSchema = z.enum(["spec", "security"]);
export type ScoredBench = z.infer<typeof ScoredBenchSchema>;

export const ScoreRequirementSchema = z
  .object({
    id: RequirementIdSchema,
    bench: ScoredBenchSchema,
    severity: SeveritySchema,
    status: RequirementStatusSchema,
    weight: z.number().positive(),
    earned: z.number().nonnegative(),
  })
  .strict();
export type ScoreRequirement = z.infer<typeof ScoreRequirementSchema>;

export const BenchScoreSchema = z
  .object({
    score: z.number().min(0).max(100),
    earnedWeight: z.number().nonnegative(),
    totalWeight: z.number().positive(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    drifted: z.number().int().nonnegative(),
    unverified: z.number().int().nonnegative(),
  })
  .strict();
export type BenchScore = z.infer<typeof BenchScoreSchema>;

export const StructuralMetricsSchema = z
  .object({
    moduleCount: z.number().int().nonnegative(),
    importEdges: z.number().int().nonnegative(),
    dependencyCycles: z.number().int().nonnegative(),
    maxFanOut: z.number().int().nonnegative(),
    orphanModules: z.number().int().nonnegative(),
    orphanRatio: z.number().min(0).max(1),
  })
  .strict();
export type StructuralMetrics = z.infer<typeof StructuralMetricsSchema>;

export const StructuralMetricScoresSchema = z
  .object({
    cycles: z.number().min(0).max(100),
    maxFanOut: z.number().min(0).max(100),
    orphanRatio: z.number().min(0).max(100),
    moduleCount: z.number().min(0).max(100),
  })
  .strict();
export type StructuralMetricScores = z.infer<typeof StructuralMetricScoresSchema>;

export const StructuralScoreSchema = z
  .object({
    score: z.number().min(0).max(100),
    metrics: StructuralMetricsSchema,
    metricScores: StructuralMetricScoresSchema,
    warnings: z.array(z.string().max(300)).max(100),
  })
  .strict();
export type StructuralScore = z.infer<typeof StructuralScoreSchema>;

export const CapReasonSchema = z.enum([
  "critical-spec-failure",
  "critical-security-failure",
]);
export type CapReason = z.infer<typeof CapReasonSchema>;

export const ScoreResultSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    taskId: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
    taskVersion: SemverSchema,
    rulesetVersion: SemverSchema,
    scoringConfigVersion: SemverSchema,
    adapterVersion: SemverSchema,
    repositoryFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    overall: z.number().min(0).max(100),
    benches: z
      .object({
        spec: BenchScoreSchema,
        security: BenchScoreSchema,
        maintainability: StructuralScoreSchema,
      })
      .strict(),
    requirements: z.array(ScoreRequirementSchema).min(1),
    capsApplied: z.array(CapReasonSchema),
    appliedCap: z.number().min(0).max(100).nullable(),
    unverifiedRequirementIds: z.array(RequirementIdSchema),
  })
  .strict()
  .superRefine((result, context) => {
    if ((result.capsApplied.length === 0) !== (result.appliedCap === null)) {
      context.addIssue({
        code: "custom",
        path: ["appliedCap"],
        message: "An applied cap must have at least one recorded reason and vice versa.",
      });
    }

    if (result.appliedCap !== null && result.overall > result.appliedCap) {
      context.addIssue({
        code: "custom",
        path: ["overall"],
        message: "The overall score must not exceed the applied cap.",
      });
    }

    const ids = new Set<string>();

    for (const requirement of result.requirements) {
      if (ids.has(requirement.id)) {
        context.addIssue({
          code: "custom",
          path: ["requirements"],
          message: `Duplicate requirement ${requirement.id}.`,
        });
      }

      ids.add(requirement.id);
    }
  });
export type ScoreResult = z.infer<typeof ScoreResultSchema>;
