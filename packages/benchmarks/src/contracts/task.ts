import { z } from "zod";

import {
  CheckSchema,
  ProjectFileSchema,
  RequirementIdSchema,
  SeveritySchema,
} from "@orivoxx/core";

import { ScoringConfigSchema, SemverSchema } from "./scoring.js";

export const TaskIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,63}$/, "Task id must be lowercase kebab-case.");
export type TaskId = z.infer<typeof TaskIdSchema>;

export const TaskDifficultySchema = z.enum(["starter", "intermediate", "advanced"]);
export type TaskDifficulty = z.infer<typeof TaskDifficultySchema>;

export const TaskRequirementSchema = z
  .object({
    id: RequirementIdSchema,
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    severity: SeveritySchema,
    bench: z.enum(["spec", "security"]),
    checks: z.array(CheckSchema).min(1),
  })
  .strict();
export type TaskRequirement = z.infer<typeof TaskRequirementSchema>;

export const TaskManifestSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    id: TaskIdSchema,
    version: SemverSchema,
    title: z.string().min(1).max(120),
    summary: z.string().min(1).max(600),
    difficulty: TaskDifficultySchema,
    tags: z.array(z.string().min(1).max(32)).max(12),
    specPath: z.literal("PROJECT_SPEC.md"),
    rulesetVersion: SemverSchema,
    scoringConfigVersion: SemverSchema,
    timeLimitSeconds: z.number().int().min(30).max(3600),
    maxSteps: z.number().int().min(1).max(500),
    maxOutputBytes: z.number().int().min(1024).max(10_485_760),
    network: z.enum(["none", "model-proxy"]),
    startingFiles: z.array(ProjectFileSchema).min(1).max(60),
    requirementBenches: z.record(RequirementIdSchema, z.enum(["spec", "security"])),
  })
  .strict()
  .superRefine((manifest, context) => {
    const paths = new Set<string>();

    for (const file of manifest.startingFiles) {
      if (paths.has(file.path)) {
        context.addIssue({
          code: "custom",
          path: ["startingFiles"],
          message: `Duplicate starting file path "${file.path}".`,
        });
      }

      paths.add(file.path);
    }

    if (!paths.has(manifest.specPath)) {
      context.addIssue({
        code: "custom",
        path: ["startingFiles"],
        message: `Starting files must include ${manifest.specPath}.`,
      });
    }

    if (new Set(manifest.tags).size !== manifest.tags.length) {
      context.addIssue({
        code: "custom",
        path: ["tags"],
        message: "Task tags must be unique.",
      });
    }
  });
export type TaskManifest = z.infer<typeof TaskManifestSchema>;

export const RulesetSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    id: TaskIdSchema,
    version: SemverSchema,
    taskId: TaskIdSchema,
    requirements: z.array(TaskRequirementSchema).min(1),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type Ruleset = z.infer<typeof RulesetSchema>;

export const TaskDefinitionSchema = z
  .object({
    manifest: TaskManifestSchema,
    specText: z.string().min(1),
    ruleset: RulesetSchema,
    scoringConfig: ScoringConfigSchema,
  })
  .strict()
  .superRefine((definition, context) => {
    if (definition.ruleset.taskId !== definition.manifest.id) {
      context.addIssue({
        code: "custom",
        path: ["ruleset", "taskId"],
        message: "Ruleset taskId must match the manifest id.",
      });
    }

    if (definition.ruleset.version !== definition.manifest.rulesetVersion) {
      context.addIssue({
        code: "custom",
        path: ["ruleset", "version"],
        message: "Ruleset version must match the manifest rulesetVersion.",
      });
    }

    if (definition.scoringConfig.version !== definition.manifest.scoringConfigVersion) {
      context.addIssue({
        code: "custom",
        path: ["scoringConfig", "version"],
        message: "Scoring config version must match the manifest scoringConfigVersion.",
      });
    }

    const specFile = definition.manifest.startingFiles.find(
      (file) => file.path === definition.manifest.specPath,
    );

    if (specFile === undefined || specFile.content !== definition.specText) {
      context.addIssue({
        code: "custom",
        path: ["specText"],
        message: "The starting PROJECT_SPEC.md must contain the task specText.",
      });
    }
  });
export type TaskDefinition = z.infer<typeof TaskDefinitionSchema>;

export const TaskSummarySchema = z
  .object({
    id: TaskIdSchema,
    version: SemverSchema,
    title: z.string().min(1),
    summary: z.string().min(1),
    difficulty: TaskDifficultySchema,
    tags: z.array(z.string()),
    rulesetVersion: SemverSchema,
    scoringConfigVersion: SemverSchema,
    requirementCount: z.number().int().positive(),
    benchCounts: z
      .object({
        spec: z.number().int().nonnegative(),
        security: z.number().int().nonnegative(),
      })
      .strict(),
    timeLimitSeconds: z.number().int().positive(),
    pinned: z.boolean(),
  })
  .strict();
export type TaskSummary = z.infer<typeof TaskSummarySchema>;
