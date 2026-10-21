import { z } from "zod";

import { ProjectFileSchema } from "../contracts/project.js";
import { SourceKindSchema } from "../contracts/enums.js";

export const VerifyRequestSchema = z
  .object({
    projectName: z.string().min(1).max(200),
    specText: z.string().min(1).max(2_000_000),
    files: z.array(ProjectFileSchema).min(1).max(300),
    sourceSharingAcknowledged: z.boolean(),
    sourceKind: SourceKindSchema,
  })
  .strict()
  .refine(
    (request) => request.sourceKind !== "upload" || request.sourceSharingAcknowledged,
    {
      message: "Uploaded source requires explicit source-sharing acknowledgement.",
      path: ["sourceSharingAcknowledged"],
    },
  );

export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;

export class VerifyRequestValidationError extends Error {
  readonly code = "invalid_verify_request";
  readonly issues: z.ZodError["issues"];

  constructor(issues: z.ZodError["issues"]) {
    super("Invalid verify request.");
    this.name = "VerifyRequestValidationError";
    this.issues = issues;
  }
}

export function ValidateVerifyRequest(input: unknown) {
  return VerifyRequestSchema.safeParse(input);
}

export function assertValidVerifyRequest(input: unknown): VerifyRequest {
  const parsed = ValidateVerifyRequest(input);

  if (!parsed.success) {
    throw new VerifyRequestValidationError(parsed.error.issues);
  }

  return parsed.data;
}
