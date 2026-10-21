import { z } from "zod";

import { EvidenceOriginSchema, EvidenceTypeSchema } from "./enums.js";
import { RelativePathSchema } from "./helpers.js";

export const EvidenceIdSchema = z.string().regex(/^EV-[A-Z0-9]+$/);
export type EvidenceId = z.infer<typeof EvidenceIdSchema>;

export const EvidenceSchema = z
  .object({
    id: EvidenceIdSchema,
    type: EvidenceTypeSchema,
    origin: EvidenceOriginSchema,
    path: RelativePathSchema.optional(),
    startLine: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional(),
    summary: z.string().min(1),
    fingerprint: z.string().min(1),
  })
  .strict();
export type Evidence = z.infer<typeof EvidenceSchema>;
