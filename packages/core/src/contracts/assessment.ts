import { z } from "zod";

import { AssessmentStatusSchema, ConfidenceSchema } from "./enums.js";

export const AssessmentSchema = z
  .object({
    requestId: z.string().min(1),
    requirementId: z.string().min(1),
    status: AssessmentStatusSchema,
    rationale: z.string().min(1),
    confidence: ConfidenceSchema,
    evidenceRefIds: z.array(z.string().min(1)),
  })
  .strict();
export type Assessment = z.infer<typeof AssessmentSchema>;

export const AssessmentEnvelopeSchema = z
  .object({
    requestId: z.string().min(1),
    modelId: z.string().min(1),
    assessments: z.array(AssessmentSchema),
  })
  .strict();
export type AssessmentEnvelope = z.infer<typeof AssessmentEnvelopeSchema>;
