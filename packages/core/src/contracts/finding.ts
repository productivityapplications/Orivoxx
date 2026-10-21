import { z } from "zod";

import { ConfidenceSchema, EvidenceOriginSchema, RequirementStatusSchema, SeveritySchema } from "./enums.js";
import { RelativePathSchema } from "./helpers.js";

export const FindingIdSchema = z.string().regex(/^FND-[A-Z0-9]+$/);
export type FindingId = z.infer<typeof FindingIdSchema>;

export const FindingSchema = z
  .object({
    id: FindingIdSchema,
    requirementId: z.string().min(1),
    status: RequirementStatusSchema,
    severity: SeveritySchema,
    summary: z.string().min(1),
    reason: z.string().min(1),
    evidenceIds: z.array(z.string().min(1)),
    origin: EvidenceOriginSchema,
    confidence: ConfidenceSchema.optional(),
    path: RelativePathSchema.optional(),
    startLine: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional(),
  })
  .strict();
export type Finding = z.infer<typeof FindingSchema>;
