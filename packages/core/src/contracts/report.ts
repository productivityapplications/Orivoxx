import { z } from "zod";

import { ProjectGraphSchema } from "../graph/contracts/index.js";
import { EvidenceSchema } from "./evidence.js";
import { FindingSchema } from "./finding.js";
import { GateSchema, RequirementStatusSchema, RunStateSchema } from "./enums.js";
import { IsoTimestampSchema } from "./helpers.js";

export const ReportSummarySchema = z
  .object({
    totalRequirements: z.number().int().nonnegative(),
    pass: z.number().int().nonnegative(),
    fail: z.number().int().nonnegative(),
    drift: z.number().int().nonnegative(),
    unverified: z.number().int().nonnegative(),
  })
  .strict();
export type ReportSummary = z.infer<typeof ReportSummarySchema>;

export const RequirementResultSchema = z
  .object({
    requirementId: z.string().min(1),
    status: RequirementStatusSchema,
    findingIds: z.array(z.string().min(1)),
    evidenceIds: z.array(z.string().min(1)),
  })
  .strict();
export type RequirementResult = z.infer<typeof RequirementResultSchema>;

export const ModelMetaSchema = z
  .object({
    provider: z.literal("nebius-token-factory"),
    modelId: z.string().min(1),
    called: z.boolean(),
    latencyMs: z.number().nonnegative().optional(),
  })
  .strict();
export type ModelMeta = z.infer<typeof ModelMetaSchema>;

export const VerificationReportSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    runId: z.string().min(1),
    projectName: z.string().min(1),
    createdAt: IsoTimestampSchema,
    snapshotFingerprint: z.string().min(1),
    runState: RunStateSchema,
    gate: GateSchema,
    summary: ReportSummarySchema,
    requirements: z.array(RequirementResultSchema),
    findings: z.array(FindingSchema),
    evidence: z.array(EvidenceSchema),
    warnings: z.array(z.string()),
    graph: ProjectGraphSchema,
    model: ModelMetaSchema,
  })
  .strict();
export type VerificationReport = z.infer<typeof VerificationReportSchema>;
