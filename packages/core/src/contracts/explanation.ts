import { z } from "zod";

import { ExplanationDepthSchema } from "./enums.js";
import { IsoTimestampSchema, RelativePathSchema } from "./helpers.js";

export const SourceRefSchema = z
  .object({
    evidenceId: z.string().min(1),
    path: RelativePathSchema,
    startLine: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional(),
  })
  .strict();
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const ExplanationSchema = z
  .object({
    explanationId: z.string().min(1),
    subjectFingerprint: z.string().min(1),
    depth: ExplanationDepthSchema,
    summary: z.string().min(1),
    whatItDoes: z.string().min(1),
    whyItMatters: z.string().min(1),
    concepts: z.array(z.string()),
    assumptions: z.array(z.string()),
    caveats: z.array(z.string()),
    sourceRefs: z.array(SourceRefSchema),
    suggestedNextQuestion: z.string().optional(),
    modelId: z.string().min(1),
    generatedAt: IsoTimestampSchema,
  })
  .strict();
export type Explanation = z.infer<typeof ExplanationSchema>;
