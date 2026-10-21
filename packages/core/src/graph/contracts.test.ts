import { describe, expect, it } from "vitest";

import {
  GraphCoverageWarningSchema,
  ProjectGraphEdgeSchema,
  ProjectGraphNodeSchema,
  ProjectGraphSchema,
} from "./contracts";

const validSourceNode = {
  id: "file-src-lib-db-ts",
  path: "src/lib/db.ts",
  label: "db.ts",
  kind: "source_file",
};

const validExternalNode = {
  id: "pkg-react",
  path: "package.json",
  label: "react",
  kind: "external_package",
  externalPackage: { name: "react", version: "^19.0.0" },
};

const validEdge = {
  id: "edge-1",
  source: "file-src-app-page-tsx",
  target: "file-src-lib-db-ts",
  relationship: "static_import",
  evidencePath: "src/app/page.tsx",
  line: 3,
};

describe("ProjectGraphNodeSchema", () => {
  it("accepts a valid source_file node", () => {
    expect(ProjectGraphNodeSchema.safeParse(validSourceNode).success).toBe(true);
  });

  it("accepts a valid external_package node with externalPackage", () => {
    expect(ProjectGraphNodeSchema.safeParse(validExternalNode).success).toBe(true);
  });

  it("rejects an external_package node without externalPackage", () => {
    const node = {
      id: "pkg-react",
      path: "package.json",
      label: "react",
      kind: "external_package",
    };

    expect(ProjectGraphNodeSchema.safeParse(node).success).toBe(false);
  });

  it("rejects a source_file node that carries externalPackage", () => {
    expect(
      ProjectGraphNodeSchema.safeParse({
        ...validSourceNode,
        externalPackage: { name: "react" },
      }).success,
    ).toBe(false);
  });

  it("rejects a node with a content field", () => {
    expect(ProjectGraphNodeSchema.safeParse({ ...validSourceNode, content: "export {};" }).success).toBe(false);
  });

  it("rejects a node path containing traversal", () => {
    expect(ProjectGraphNodeSchema.safeParse({ ...validSourceNode, path: "../secret.ts" }).success).toBe(false);
  });
});

describe("ProjectGraphEdgeSchema", () => {
  it("accepts a valid static import edge", () => {
    expect(ProjectGraphEdgeSchema.safeParse(validEdge).success).toBe(true);
  });

  it("rejects an unknown relationship", () => {
    expect(
      ProjectGraphEdgeSchema.safeParse({ ...validEdge, relationship: "runtime_call" }).success,
    ).toBe(false);
  });

  it("rejects an unknown extra field", () => {
    expect(ProjectGraphEdgeSchema.safeParse({ ...validEdge, injected: true }).success).toBe(false);
  });
});

describe("GraphCoverageWarningSchema", () => {
  it("accepts a valid warning", () => {
    expect(
      GraphCoverageWarningSchema.safeParse({
        code: "unresolved_import",
        message: "Could not resolve ./missing.",
        path: "src/app/page.tsx",
        count: 1,
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown warning code", () => {
    expect(
      GraphCoverageWarningSchema.safeParse({
        code: "model_guess",
        message: "Invented dependency.",
      }).success,
    ).toBe(false);
  });
});

describe("ProjectGraphSchema", () => {
  it("accepts a valid graph", () => {
    expect(
      ProjectGraphSchema.safeParse({
        nodes: [validSourceNode, validExternalNode],
        edges: [validEdge],
        coverageWarnings: [],
      }).success,
    ).toBe(true);
  });

  it("rejects the whole graph when one node is invalid", () => {
    expect(
      ProjectGraphSchema.safeParse({
        nodes: [validSourceNode, { ...validExternalNode, externalPackage: undefined }],
        edges: [],
        coverageWarnings: [],
      }).success,
    ).toBe(false);
  });
});
