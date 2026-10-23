import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { NormalizedFile } from "../archive/types";
import {
  VerificationReportSchema,
  type Evidence,
  type Requirement,
  type RequirementResult,
} from "../contracts";
import { computeSnapshotFingerprint, verifyDeterministic } from "./pipeline";
import {
  buildReport,
  ReportValidationError,
  type BuildReportInput,
} from "./report";

function makeFile(path: string, content: string): NormalizedFile {
  const normalized = content.replace(/\r\n?/g, "\n");

  return {
    path,
    bytes: new TextEncoder().encode(normalized),
    content: normalized,
    lineCount: normalized.length === 0 ? 0 : normalized.split("\n").length,
    fingerprint: createHash("sha256").update(normalized, "utf8").digest("hex"),
    language: path.endsWith(".json") ? "json" : "typescript",
    redacted: false,
  };
}

const requirement: Requirement = {
  id: "REQ-A",
  title: "File exists",
  description: "The file must exist.",
  severity: "high",
  verificationMode: "deterministic",
  checks: [{ type: "file_exists", path: "a.ts" }],
};

const requirementResult: RequirementResult = {
  requirementId: "REQ-A",
  status: "PASS",
  findingIds: [],
  evidenceIds: ["EV-001"],
};

const evidenceRecord: Evidence = {
  id: "EV-001",
  type: "file_presence",
  origin: "deterministic",
  path: "a.ts",
  summary: "File exists at a.ts.",
  fingerprint: "fingerprint",
};

function baseInput(): BuildReportInput {
  return {
    projectName: "Demo",
    snapshotFingerprint: "a1b2c3d4e5f6a7b8c9d0",
    requirements: [requirement],
    requirementResults: [requirementResult],
    findings: [],
    evidence: [evidenceRecord],
    warnings: [],
    gate: "PASS",
    runState: "COMPLETE",
    summary: {
      totalRequirements: 1,
      pass: 1,
      fail: 0,
      drift: 0,
      unverified: 0,
    },
    model: {
      provider: "nebius-token-factory",
      modelId: "nvidia/Nemotron-3.5-Super-VL",
      called: false,
    },
    now: new Date("2026-10-21T14:30:25.123Z"),
  };
}

const specText = `# Demo

### REQ-A - File exists
- Severity: high
- Verification: deterministic
- Description: The file must exist.
- Checks:
  - type: file_exists
    path: src/a.ts
`;

describe("buildReport", () => {
  it("produces a schema-valid report with an empty graph", () => {
    const report = buildReport(baseInput());

    expect(VerificationReportSchema.safeParse(report).success).toBe(true);
    expect(report.schemaVersion).toBe("1.0.0");
    expect(report.graph).toEqual({ nodes: [], edges: [], coverageWarnings: [] });
    expect(report.model.called).toBe(false);
  });

  it("is stable for the same snapshot and timestamp", () => {
    const first = buildReport(baseInput());
    const second = buildReport(baseInput());

    expect(first.runId).toBe("a1b2c3d4e5f6-20261021T143025Z");
    expect(first.runId).toBe(second.runId);
    expect(first.createdAt).toBe(second.createdAt);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("throws a structured error for a missing gate", () => {
    const input = { ...baseInput(), gate: undefined } as unknown as BuildReportInput;

    expect(() => buildReport(input)).toThrow(ReportValidationError);

    try {
      buildReport(input);
    } catch (error) {
      expect(error).toBeInstanceOf(ReportValidationError);
      expect((error as ReportValidationError).fieldPath).toBe("gate");
    }
  });

  it("throws a structured error for an unknown requirement result", () => {
    const input = {
      ...baseInput(),
      requirementResults: [
        { ...requirementResult, requirementId: "REQ-UNKNOWN" },
      ],
    };

    expect(() => buildReport(input)).toThrow(ReportValidationError);
  });
});

describe("verifyDeterministic", () => {
  it("runs checks, evidence, aggregation and report without a provider call", () => {
    const report = verifyDeterministic({
      projectName: "Demo",
      specText,
      files: [
        makeFile("src/a.ts", "export const a = 1;\n"),
        makeFile("package.json", '{"dependencies":{"react":"^19.0.0"}}'),
      ],
      now: new Date("2026-10-21T14:30:25.123Z"),
    });

    expect(VerificationReportSchema.safeParse(report).success).toBe(true);
    expect(report.requirements[0]?.status).toBe("PASS");
    expect(report.gate).toBe("PASS");
    expect(report.runState).toBe("COMPLETE");
    expect(report.evidence.length).toBeGreaterThan(0);
    expect(report.model).toEqual({
      provider: "nebius-token-factory",
      modelId: "nvidia/Nemotron-3.5-Super-VL",
      called: false,
    });
  });

  it("produces identical output for identical input and timestamp", () => {
    const input = {
      projectName: "Demo",
      specText,
      files: [makeFile("src/a.ts", "export const a = 1;\n")],
      now: new Date("2026-10-21T14:30:25.123Z"),
    };

    expect(JSON.stringify(verifyDeterministic(input))).toBe(
      JSON.stringify(verifyDeterministic(input)),
    );
  });

  it("throws a structured error for an invalid specification", () => {
    expect(() =>
      verifyDeterministic({
        projectName: "Demo",
        specText: "# No requirements",
        files: [makeFile("src/a.ts", "export const a = 1;\n")],
      }),
    ).toThrow("no parseable requirement blocks");
  });
});

describe("computeSnapshotFingerprint", () => {
  it("is independent of file input order", () => {
    const first = makeFile("b.ts", "b");
    const second = makeFile("a.ts", "a");

    expect(computeSnapshotFingerprint("spec", [first, second])).toBe(
      computeSnapshotFingerprint("spec", [second, first]),
    );
  });

  it("changes when file content changes", () => {
    expect(
      computeSnapshotFingerprint("spec", [makeFile("a.ts", "one")]),
    ).not.toBe(computeSnapshotFingerprint("spec", [makeFile("a.ts", "two")]));
  });
});
