import { describe, expect, it } from "vitest";

import {
  ApiErrorSchema,
  AssessmentEnvelopeSchema,
  AssessmentSchema,
  AssessmentStatusSchema,
  CheckSchema,
  ConfidenceSchema,
  EvidenceOriginSchema,
  EvidenceSchema,
  EvidenceTypeSchema,
  ExplanationDepthSchema,
  ExplanationSchema,
  FindingSchema,
  FixtureManifestSchema,
  GateSchema,
  ModelMetaSchema,
  ProjectFileSchema,
  ProjectInputSchema,
  RelativePathSchema,
  ReportSummarySchema,
  RequirementResultSchema,
  RequirementSchema,
  RequirementStatusSchema,
  RunStateSchema,
  SeveritySchema,
  SourceKindSchema,
  SourceRefSchema,
  VerificationModeSchema,
  VerificationReportSchema,
} from "./index";

const validGraph = {
  nodes: [
    {
      id: "file-src-lib-db-ts",
      path: "src/lib/db.ts",
      label: "db.ts",
      kind: "source_file",
    },
    {
      id: "pkg-react",
      path: "package.json",
      label: "react",
      kind: "external_package",
      externalPackage: { name: "react", version: "^19.0.0" },
    },
  ],
  edges: [
    {
      id: "edge-1",
      source: "file-src-lib-db-ts",
      target: "pkg-react",
      relationship: "static_import",
      evidencePath: "src/lib/db.ts",
      line: 1,
    },
  ],
  coverageWarnings: [],
};

const validAssessment = {
  requestId: "req-1",
  requirementId: "REQ-AUTH-001",
  status: "FAIL",
  rationale: "The handler reads a project without checking ownership.",
  confidence: "HIGH",
  evidenceRefIds: ["EV-001"],
};

const validEvidence = {
  id: "EV-001",
  type: "semantic_observation",
  origin: "semantic",
  path: "src/app/api/projects/[id]/route.ts",
  startLine: 10,
  endLine: 14,
  summary: "Project fetched by id without an ownership assertion.",
  fingerprint: "snapshot-1:route.ts",
};

const validFinding = {
  id: "FND-001",
  requirementId: "REQ-AUTH-001",
  status: "FAIL",
  severity: "critical",
  summary: "Owner scope is not enforced.",
  reason: "The handler returns a project without verifying its owner.",
  evidenceIds: ["EV-001"],
  origin: "semantic",
  confidence: "HIGH",
  path: "src/app/api/projects/[id]/route.ts",
  startLine: 10,
  endLine: 14,
};

const validReport = {
  schemaVersion: "1.0.0",
  runId: "run-1",
  projectName: "TaskBoard",
  createdAt: "2026-10-20T12:00:00.000Z",
  snapshotFingerprint: "snapshot-1",
  runState: "COMPLETE",
  gate: "BLOCKED",
  summary: { totalRequirements: 1, pass: 0, fail: 1, drift: 0, unverified: 0 },
  requirements: [
    {
      requirementId: "REQ-AUTH-001",
      status: "FAIL",
      findingIds: ["FND-001"],
      evidenceIds: ["EV-001"],
    },
  ],
  findings: [validFinding],
  evidence: [validEvidence],
  warnings: [],
  graph: validGraph,
  model: {
    provider: "nebius-token-factory",
    modelId: "nvidia/Nemotron-3.5-Super-VL",
    called: true,
    latencyMs: 812,
  },
};

describe("enums", () => {
  const enumCases: ReadonlyArray<
    readonly [string, { safeParse: (value: unknown) => { success: boolean } }]
  > = [
    ["Severity", SeveritySchema],
    ["VerificationMode", VerificationModeSchema],
    ["RequirementStatus", RequirementStatusSchema],
    ["RunState", RunStateSchema],
    ["Gate", GateSchema],
    ["EvidenceType", EvidenceTypeSchema],
    ["EvidenceOrigin", EvidenceOriginSchema],
    ["AssessmentStatus", AssessmentStatusSchema],
    ["Confidence", ConfidenceSchema],
    ["ExplanationDepth", ExplanationDepthSchema],
    ["SourceKind", SourceKindSchema],
  ];

  it.each(enumCases)("%s rejects an invalid value", (_name, schema) => {
    expect(schema.safeParse("not-a-valid-value").success).toBe(false);
  });
});

describe("RelativePathSchema", () => {
  it("accepts a relative path and normalises backslashes", () => {
    expect(RelativePathSchema.parse("src\\lib\\db.ts")).toBe("src/lib/db.ts");
  });

  it("rejects traversal, absolute, drive, NUL and empty paths", () => {
    const invalidPaths = ["../etc/passwd", "src/../../etc/passwd", "/abs/path", "C:\\Users\\x", "src/lib/\0db.ts", ""];

    for (const path of invalidPaths) {
      expect(RelativePathSchema.safeParse(path).success).toBe(false);
    }
  });
});

describe("project contracts", () => {
  it("accepts a valid ProjectFile and ProjectInput", () => {
    expect(ProjectFileSchema.safeParse({ path: "src/lib/db.ts", content: "export const db = {};" }).success).toBe(true);
    expect(
      ProjectInputSchema.safeParse({
        projectName: "TaskBoard",
        specText: "# Spec",
        files: [{ path: "src/lib/db.ts", content: "export const db = {};" }],
        sourceKind: "sample",
        sourceSharingAcknowledged: true,
      }).success,
    ).toBe(true);
  });

  it.each([["../etc/passwd"], ["/abs/path"], ["C:\\Users\\x"], ["src/\0db.ts"]])(
    "rejects ProjectFile path %s",
    (path) => {
      expect(ProjectFileSchema.safeParse({ path, content: "" }).success).toBe(false);
    },
  );

  it("rejects unknown ProjectFile fields", () => {
    expect(
      ProjectFileSchema.safeParse({ path: "src/lib/db.ts", content: "", extra: true }).success,
    ).toBe(false);
  });
});

describe("requirement contracts", () => {
  const validChecks = [
    { type: "file_exists", path: "src/lib/db.ts" },
    { type: "file_absent", path: "src/lib/legacy.ts" },
    { type: "text_contains", path: "src/lib/db.ts", text: "export const db" },
    { type: "text_not_contains", path: "src/lib/db.ts", text: "shelljs" },
    { type: "dependency_present", name: "react" },
    { type: "dependency_absent", name: "shelljs" },
    {
      type: "source_reference_exists",
      path: "src/app/page.ts",
      referencedPath: "src/lib/db.ts",
    },
  ];

  it.each(validChecks)("accepts $type check", (check) => {
    expect(CheckSchema.safeParse(check).success).toBe(true);
  });

  it("rejects text_contains without text", () => {
    expect(CheckSchema.safeParse({ type: "text_contains", path: "src/lib/db.ts" }).success).toBe(false);
  });

  it("rejects an unknown check type", () => {
    expect(CheckSchema.safeParse({ type: "unknown_type", path: "src/lib/db.ts" }).success).toBe(false);
  });

  it("accepts a valid Requirement", () => {
    expect(
      RequirementSchema.safeParse({
        id: "REQ-AUTH-001",
        title: "Project access must be owner-scoped",
        description: "Every request must verify ownership.",
        severity: "critical",
        verificationMode: "semantic",
        checks: [validChecks[2]],
        lineHint: 10,
      }).success,
    ).toBe(true);
  });

  it("rejects a requirement id without the REQ- prefix", () => {
    expect(
      RequirementSchema.safeParse({
        id: "AUTH-001",
        title: "Owner scope",
        description: "Every request must verify ownership.",
        severity: "critical",
        verificationMode: "semantic",
        checks: [],
      }).success,
    ).toBe(false);
  });
});

describe("evidence, assessment and finding contracts", () => {
  it("accepts valid Evidence, Assessment and Finding objects", () => {
    expect(EvidenceSchema.safeParse(validEvidence).success).toBe(true);
    expect(AssessmentSchema.safeParse(validAssessment).success).toBe(true);
    expect(FindingSchema.safeParse(validFinding).success).toBe(true);
    expect(AssessmentEnvelopeSchema.safeParse({
      requestId: "req-1",
      modelId: "nvidia/Nemotron-3.5-Super-VL",
      assessments: [validAssessment],
    }).success).toBe(true);
    expect(
      EvidenceSchema.safeParse({
        id: "EV-002",
        type: "file_presence",
        origin: "deterministic",
        summary: "Required file exists.",
        fingerprint: "snapshot-1:file",
      }).success,
    ).toBe(true);
  });

  it("rejects unknown fields on Assessment", () => {
    expect(AssessmentSchema.safeParse({ ...validAssessment, extra: "nope" }).success).toBe(false);
  });

  it("rejects malformed evidence and finding ids", () => {
    expect(EvidenceSchema.safeParse({ ...validEvidence, id: "EV001" }).success).toBe(false);
    expect(FindingSchema.safeParse({ ...validFinding, id: "FND001" }).success).toBe(false);
    expect(EvidenceOriginSchema.safeParse("model").success).toBe(false);
  });
});

describe("explanation contracts", () => {
  const validExplanation = {
    explanationId: "expl-1",
    subjectFingerprint: "snapshot-1:route.ts",
    depth: "BEGINNER",
    summary: "The handler must check ownership.",
    whatItDoes: "Loads and returns a project record.",
    whyItMatters: "Without an ownership check any caller can read the project.",
    concepts: ["authorization", "session"],
    assumptions: ["The session helper returns the authenticated user."],
    caveats: ["Synthetic fixture; no real authentication is present."],
    sourceRefs: [
      {
        evidenceId: "EV-001",
        path: "src/app/api/projects/[id]/route.ts",
        startLine: 10,
        endLine: 14,
      },
    ],
    modelId: "nvidia/Nemotron-3.5-Super-VL",
    generatedAt: "2026-10-20T12:00:00.000Z",
  };

  it("accepts a valid SourceRef and Explanation", () => {
    expect(SourceRefSchema.safeParse(validExplanation.sourceRefs[0]).success).toBe(true);
    expect(ExplanationSchema.safeParse(validExplanation).success).toBe(true);
  });

  it("rejects depth expert", () => {
    expect(ExplanationSchema.safeParse({ ...validExplanation, depth: "expert" }).success).toBe(false);
  });
});

describe("report contracts", () => {
  it("accepts valid summary, requirement result and model meta", () => {
    expect(
      ReportSummarySchema.safeParse({ totalRequirements: 1, pass: 0, fail: 1, drift: 0, unverified: 0 }).success,
    ).toBe(true);
    expect(
      RequirementResultSchema.safeParse({
        requirementId: "REQ-AUTH-001",
        status: "FAIL",
        findingIds: ["FND-001"],
        evidenceIds: ["EV-001"],
      }).success,
    ).toBe(true);
    expect(
      ModelMetaSchema.safeParse({
        provider: "nebius-token-factory",
        modelId: "nvidia/Nemotron-3.5-Super-VL",
        called: false,
      }).success,
    ).toBe(true);
  });

  it("accepts a valid VerificationReport", () => {
    expect(VerificationReportSchema.safeParse(validReport).success).toBe(true);
  });

  it("rejects a VerificationReport missing graph", () => {
    expect(VerificationReportSchema.safeParse({ ...validReport, graph: undefined }).success).toBe(false);
  });

  it("rejects an unknown provider", () => {
    expect(
      ModelMetaSchema.safeParse({
        provider: "openai",
        modelId: "nvidia/Nemotron-3.5-Super-VL",
        called: false,
      }).success,
    ).toBe(false);
  });
});

describe("error and fixture manifest contracts", () => {
  it("accepts a valid ApiError and rejects a missing requestId", () => {
    expect(
      ApiErrorSchema.safeParse({
        error: { code: "INVALID_REQUEST", message: "Bad request.", retryable: false, requestId: "req-1" },
      }).success,
    ).toBe(true);
    expect(
      ApiErrorSchema.safeParse({
        error: { code: "INVALID_REQUEST", message: "Bad request.", retryable: false },
      }).success,
    ).toBe(false);
  });

  it("accepts a valid FixtureManifest and rejects a bad expectedGate", () => {
    const manifest = {
      name: "taskboard-regressed",
      version: "1",
      specPath: "PROJECT_SPEC.md",
      expectedRunState: "COMPLETE",
      expectedGate: "BLOCKED",
      expectedRequirementStatuses: { "REQ-AUTH-001": "FAIL" },
      knownDeviations: [{ requirementId: "REQ-AUTH-001", note: "No ownership check." }],
    };

    expect(FixtureManifestSchema.safeParse(manifest).success).toBe(true);
    expect(FixtureManifestSchema.safeParse({ ...manifest, expectedGate: "PENDING" }).success).toBe(false);
  });
});
