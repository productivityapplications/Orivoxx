import { z } from "zod";

import { SeveritySchema, VerificationModeSchema } from "./enums.js";
import { RelativePathSchema } from "./helpers.js";

export const RequirementIdSchema = z.string().regex(/^REQ-[A-Z0-9]+(-[A-Z0-9]+)*$/);
export type RequirementId = z.infer<typeof RequirementIdSchema>;

const FileExistsCheckSchema = z
  .object({
    type: z.literal("file_exists"),
    path: RelativePathSchema,
  })
  .strict();

const FileAbsentCheckSchema = z
  .object({
    type: z.literal("file_absent"),
    path: RelativePathSchema,
  })
  .strict();

const TextContainsCheckSchema = z
  .object({
    type: z.literal("text_contains"),
    path: RelativePathSchema,
    text: z.string().min(1),
  })
  .strict();

const TextNotContainsCheckSchema = z
  .object({
    type: z.literal("text_not_contains"),
    path: RelativePathSchema,
    text: z.string().min(1),
  })
  .strict();

const DependencyPresentCheckSchema = z
  .object({
    type: z.literal("dependency_present"),
    name: z.string().min(1),
  })
  .strict();

const DependencyAbsentCheckSchema = z
  .object({
    type: z.literal("dependency_absent"),
    name: z.string().min(1),
  })
  .strict();

// source_reference_exists: file at `path` must contain a static reference to
// `referencedPath`. Precise extraction is Phase 3/5; schema shape is stable and
// must not change without architecture approval.
const SourceReferenceExistsCheckSchema = z
  .object({
    type: z.literal("source_reference_exists"),
    path: RelativePathSchema,
    referencedPath: RelativePathSchema,
  })
  .strict();

export const CheckSchema = z.discriminatedUnion("type", [
  FileExistsCheckSchema,
  FileAbsentCheckSchema,
  TextContainsCheckSchema,
  TextNotContainsCheckSchema,
  DependencyPresentCheckSchema,
  DependencyAbsentCheckSchema,
  SourceReferenceExistsCheckSchema,
]);
export type Check = z.infer<typeof CheckSchema>;

export const RequirementSchema = z
  .object({
    id: RequirementIdSchema,
    title: z.string().min(1),
    description: z.string().min(1),
    severity: SeveritySchema,
    verificationMode: VerificationModeSchema,
    checks: z.array(CheckSchema),
    lineHint: z.number().int().positive().optional(),
  })
  .strict();
export type Requirement = z.infer<typeof RequirementSchema>;
