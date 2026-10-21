import { z } from "zod";

import { GateSchema, RequirementStatusSchema, RunStateSchema } from "./enums.js";
import { RelativePathSchema } from "./helpers.js";

export const KnownDeviationSchema = z
  .object({
    requirementId: z.string().min(1),
    note: z.string().min(1),
  })
  .strict();
export type KnownDeviation = z.infer<typeof KnownDeviationSchema>;

export const FixtureManifestSchema = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1),
    specPath: RelativePathSchema,
    expectedRunState: RunStateSchema,
    expectedGate: GateSchema,
    expectedRequirementStatuses: z.record(z.string(), RequirementStatusSchema),
    knownDeviations: z.array(KnownDeviationSchema),
  })
  .strict();
export type FixtureManifest = z.infer<typeof FixtureManifestSchema>;
