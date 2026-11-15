import { z } from "zod";

export const SemverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/, "Expected a semantic version.");
export type Semver = z.infer<typeof SemverSchema>;

export const BenchKeySchema = z.enum(["spec", "security", "maintainability"]);
export type BenchKey = z.infer<typeof BenchKeySchema>;

export const SeverityWeightSchema = z
  .object({
    critical: z.number().positive(),
    high: z.number().positive(),
    medium: z.number().positive(),
    low: z.number().positive(),
  })
  .strict();
export type SeverityWeights = z.infer<typeof SeverityWeightSchema>;

export const BenchWeightsSchema = z
  .object({
    spec: z.number().min(0).max(1),
    security: z.number().min(0).max(1),
    maintainability: z.number().min(0).max(1),
  })
  .strict()
  .refine(
    (weights) =>
      Math.abs(weights.spec + weights.security + weights.maintainability - 1) < 1e-9,
    { message: "Bench weights must sum to 1." },
  );
export type BenchWeights = z.infer<typeof BenchWeightsSchema>;

export const StructuralThresholdsSchema = z
  .object({
    cycles: z
      .object({
        good: z.number().int().nonnegative(),
        warn: z.number().int().nonnegative(),
      })
      .strict(),
    maxFanOut: z
      .object({
        good: z.number().int().positive(),
        warn: z.number().int().positive(),
      })
      .strict(),
    orphanRatio: z
      .object({
        good: z.number().min(0).max(1),
        warn: z.number().min(0).max(1),
      })
      .strict(),
    moduleCount: z
      .object({
        min: z.number().int().positive(),
        max: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();
export type StructuralThresholds = z.infer<typeof StructuralThresholdsSchema>;

export const ScoringConfigSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    version: SemverSchema,
    benchWeights: BenchWeightsSchema,
    severityWeights: SeverityWeightSchema,
    caps: z
      .object({
        criticalSpec: z.number().min(0).max(100),
        criticalSecurity: z.number().min(0).max(100),
      })
      .strict(),
    structural: StructuralThresholdsSchema,
  })
  .strict();
export type ScoringConfig = z.infer<typeof ScoringConfigSchema>;
