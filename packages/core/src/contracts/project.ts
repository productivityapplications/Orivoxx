import { z } from "zod";

import { SourceKindSchema } from "./enums.js";
import { RelativePathSchema } from "./helpers.js";

export const ProjectFileSchema = z
  .object({
    path: RelativePathSchema,
    content: z.string(),
  })
  .strict();
export type ProjectFile = z.infer<typeof ProjectFileSchema>;

export const ProjectInputSchema = z
  .object({
    projectName: z.string().min(1),
    specText: z.string(),
    files: z.array(ProjectFileSchema),
    sourceKind: SourceKindSchema,
    sourceSharingAcknowledged: z.boolean(),
  })
  .strict();
export type ProjectInput = z.infer<typeof ProjectInputSchema>;
