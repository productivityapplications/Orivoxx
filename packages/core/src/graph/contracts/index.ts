import { z } from "zod";

import { RelativePathSchema } from "../../contracts/helpers.js";

// Graph nodes carry structure, never source content. The model MUST NOT produce
// graph data; only the Phase 5 graph builder does. This schema enforces no
// `content` field.
export const ProjectGraphNodeSchema = z
  .object({
    id: z.string().min(1),
    path: RelativePathSchema,
    label: z.string().min(1),
    kind: z.enum(["source_file", "external_package"]),
    externalPackage: z
      .object({
        name: z.string().min(1),
        version: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (node) => (node.kind === "external_package") === (node.externalPackage !== undefined),
    {
      message: "externalPackage must be present if and only if kind is external_package.",
      path: ["externalPackage"],
    },
  );
export type ProjectGraphNode = z.infer<typeof ProjectGraphNodeSchema>;

export const GraphEdgeRelationshipSchema = z.enum([
  "static_import",
  "export_from",
  "require",
  "dynamic_import",
]);
export type GraphEdgeRelationship = z.infer<typeof GraphEdgeRelationshipSchema>;

export const ProjectGraphEdgeSchema = z
  .object({
    id: z.string().min(1),
    source: z.string().min(1),
    target: z.string().min(1),
    relationship: GraphEdgeRelationshipSchema,
    evidencePath: RelativePathSchema,
    line: z.number().int().positive().optional(),
  })
  .strict();
export type ProjectGraphEdge = z.infer<typeof ProjectGraphEdgeSchema>;

export const GraphCoverageWarningCodeSchema = z.enum([
  "unsupported_path_alias",
  "unresolved_import",
  "unsupported_dynamic_import",
  "file_count_exceeded",
  "parse_error",
]);
export type GraphCoverageWarningCode = z.infer<typeof GraphCoverageWarningCodeSchema>;

export const GraphCoverageWarningSchema = z
  .object({
    code: GraphCoverageWarningCodeSchema,
    message: z.string().min(1),
    path: RelativePathSchema.optional(),
    count: z.number().int().nonnegative().optional(),
  })
  .strict();
export type GraphCoverageWarning = z.infer<typeof GraphCoverageWarningSchema>;

export const ProjectGraphSchema = z
  .object({
    nodes: z.array(ProjectGraphNodeSchema),
    edges: z.array(ProjectGraphEdgeSchema),
    coverageWarnings: z.array(GraphCoverageWarningSchema),
  })
  .strict();
export type ProjectGraph = z.infer<typeof ProjectGraphSchema>;
