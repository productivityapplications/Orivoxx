import { describe, expect, it } from "vitest";

import type { CheckOutcome } from "../checks";
import type {
  Assessment,
  Check,
  Evidence,
  Requirement,
  Severity,
  VerificationMode,
} from "../contracts";
import type { EvidenceDraft } from "../evidence";
import { aggregate } from "./verdict";
import type { VerdictOutput } from "./types";

function requirement(
  id: string,
  severity: Severity,
  verificationMode: VerificationMode,
  checks: Check[] = [],
): Requirement {
  return {
    id,
    title: id,
    description: id,
    severity,
    verificationMode,
    checks,
  };
}

function evidence(id: string, path?: string, summary = "Evidence summary."): Evidence {
  return {
    id,
    type: "text_marker",
    origin: "deterministic",
    summary,
    fingerprint: "fingerprint",
    ...(path === undefined ? {} : { path }),
  };
}

function evidenceDraft(summary: string): EvidenceDraft {
  return { type: "text_marker", origin: "deterministic", summary };
}

function outcome(status: "PASS" | "FAIL"): CheckOutcome {
  if (status === "FAIL") {
    return {
      status,
      evidence: [evidenceDraft("Required text marker not found.")],
    };
  }

  return {
    status,
    evidence: [evidenceDraft("Required text marker present.")],
  };
}

function assessment(
  requirementId: string,
  status: Assessment["status"],
  evidenceRefIds: string[],
): Assessment {
  return {
    requestId: "request-1",
    requirementId,
    status,
    rationale: "Assessment rationale.",
    confidence: "HIGH",
    evidenceRefIds,
  };
}

function runAggregate(
  requirements: Requirement[],
  checkResults: Map<string, CheckOutcome> = new Map(),
  assessments: Assessment[] = [],
  requirementToEvidenceIds: Map<string, string[]> = new Map(),
  evidenceRecords: Evidence[] = [],
): VerdictOutput {
  return aggregate({
    requirements,
    checkResults,
    assessments,
    requirementToEvidenceIds,
    evidence: evidenceRecords,
  });
}

describe("R1 deterministic FAIL precedence", () => {
  it("keeps FAIL even when an assessment PASSes with valid evidence", () => {
    const req = requirement("REQ-AUTH-001", "critical", "semantic", [
      { type: "text_contains", path: "src/a.ts", text: "assertProjectOwner" },
    ]);
    const result = runAggregate(
      [req],
      new Map([[req.id, outcome("FAIL")]]),
      [assessment(req.id, "PASS", ["EV-001"])],
      new Map([[req.id, ["EV-001"]]]),
      [evidence("EV-001", "src/a.ts")],
    );

    expect(result.requirementResults[0]?.status).toBe("FAIL");
    expect(result.findings[0]?.reason).toBe("Required text marker not found.");
  });
});

describe("R2 deterministic requirement without checks", () => {
  it("is UNVERIFIED, not PASS", () => {
    const req = requirement("REQ-EMPTY", "medium", "deterministic");
    const result = runAggregate([req]);

    expect(result.requirementResults[0]?.status).toBe("UNVERIFIED");
    expect(result.findings[0]?.reason).toBe(
      "No checks declared for a deterministic requirement.",
    );
  });
});

describe("R3 semantic assessment handling", () => {
  it("R3a: PASS assessment with valid evidence is PASS", () => {
    const req = requirement("REQ-SEM", "high", "semantic");
    const result = runAggregate(
      [req],
      new Map(),
      [assessment(req.id, "PASS", ["EV-001"])],
      new Map([[req.id, ["EV-001"]]]),
      [evidence("EV-001", "src/a.ts")],
    );

    expect(result.requirementResults[0]?.status).toBe("PASS");
    expect(result.findings).toHaveLength(0);
  });

  it("R3a: merges valid assessment evidence into the requirement evidence list", () => {
    const req = requirement("REQ-SEM", "high", "semantic");
    const result = runAggregate(
      [req],
      new Map(),
      [assessment(req.id, "PASS", ["EV-002", "EV-003"])],
      new Map([[req.id, ["EV-001"]]]),
      [
        evidence("EV-001", "src/a.ts"),
        evidence("EV-002", "src/b.ts"),
        evidence("EV-003", "src/c.ts"),
      ],
    );

    expect(result.requirementResults[0]?.status).toBe("PASS");
    expect(result.requirementResults[0]?.evidenceIds).toEqual([
      "EV-001",
      "EV-002",
      "EV-003",
    ]);
  });

  it("R3b: FAIL assessment with valid evidence is FAIL", () => {
    const req = requirement("REQ-SEM", "high", "semantic");
    const result = runAggregate(
      [req],
      new Map(),
      [assessment(req.id, "FAIL", ["EV-001"])],
      new Map([[req.id, ["EV-001"]]]),
      [evidence("EV-001", "src/a.ts")],
    );

    expect(result.requirementResults[0]?.status).toBe("FAIL");
    expect(result.findings[0]?.origin).toBe("semantic");
    expect(result.findings[0]?.reason).toBe("Assessment rationale.");
  });

  it("R3c: INCONCLUSIVE assessment is UNVERIFIED", () => {
    const req = requirement("REQ-SEM", "medium", "semantic");
    const result = runAggregate(
      [req],
      new Map(),
      [assessment(req.id, "INCONCLUSIVE", ["EV-001"])],
      new Map([[req.id, ["EV-001"]]]),
      [evidence("EV-001", "src/a.ts")],
    );

    expect(result.requirementResults[0]?.status).toBe("UNVERIFIED");
    expect(result.findings[0]?.reason).toBe(
      "Semantic assessment was inconclusive.",
    );
  });

  it("R3d: all-invalid evidence references make the requirement UNVERIFIED", () => {
    const req = requirement("REQ-SEM", "medium", "semantic");
    const result = runAggregate(
      [req],
      new Map(),
      [assessment(req.id, "PASS", ["EV-999"])],
      new Map([[req.id, ["EV-999"]]]),
      [evidence("EV-001", "src/a.ts")],
    );

    expect(result.requirementResults[0]?.status).toBe("UNVERIFIED");
    expect(result.findings[0]?.reason).toBe(
      "Semantic assessment evidence references were invalid.",
    );
  });

  it("R3d: a FAIL assessment with only invalid references is UNVERIFIED", () => {
    const req = requirement("REQ-SEM", "medium", "semantic");
    const result = runAggregate(
      [req],
      new Map(),
      [assessment(req.id, "FAIL", ["EV-999"])],
      new Map([[req.id, []]]),
      [],
    );

    expect(result.requirementResults[0]?.status).toBe("UNVERIFIED");
  });

  it("R3e: a missing assessment is UNVERIFIED", () => {
    const req = requirement("REQ-SEM", "medium", "semantic");
    const result = runAggregate([req]);

    expect(result.requirementResults[0]?.status).toBe("UNVERIFIED");
    expect(result.findings[0]?.reason).toBe("No semantic assessment available.");
  });
});

describe("R4 deterministic requirement with passing checks", () => {
  it("is PASS", () => {
    const req = requirement("REQ-DET", "high", "deterministic", [
      { type: "file_exists", path: "src/a.ts" },
    ]);
    const result = runAggregate(
      [req],
      new Map([[req.id, outcome("PASS")]]),
    );

    expect(result.requirementResults[0]?.status).toBe("PASS");
    expect(result.findings).toHaveLength(0);
  });
});

describe("R5 mixed deterministic and semantic requirement", () => {
  it("is UNVERIFIED when checks pass but no assessment exists", () => {
    const req = requirement("REQ-AUTH-001", "critical", "semantic", [
      { type: "text_contains", path: "src/a.ts", text: "assertProjectOwner" },
    ]);
    const result = runAggregate(
      [req],
      new Map([[req.id, outcome("PASS")]]),
    );

    expect(result.requirementResults[0]?.status).toBe("UNVERIFIED");
  });

  it("is PASS when checks pass and a valid PASS assessment exists", () => {
    const req = requirement("REQ-AUTH-001", "critical", "semantic", [
      { type: "text_contains", path: "src/a.ts", text: "assertProjectOwner" },
    ]);
    const result = runAggregate(
      [req],
      new Map([[req.id, outcome("PASS")]]),
      [assessment(req.id, "PASS", ["EV-001"])],
      new Map([[req.id, ["EV-001"]]]),
      [evidence("EV-001", "src/a.ts")],
    );

    expect(result.requirementResults[0]?.status).toBe("PASS");
  });
});

describe("findings generation", () => {
  it("produces one finding per non-PASS requirement and none for PASS", () => {
    const passing = requirement("REQ-PASS", "low", "deterministic", [
      { type: "file_exists", path: "src/a.ts" },
    ]);
    const failing = requirement("REQ-FAIL", "high", "deterministic", [
      { type: "file_exists", path: "src/b.ts" },
    ]);
    const unverified = requirement("REQ-UNV", "medium", "deterministic");
    const result = runAggregate(
      [passing, failing, unverified],
      new Map([
        [passing.id, outcome("PASS")],
        [failing.id, outcome("FAIL")],
      ]),
    );

    expect(result.findings).toHaveLength(2);
    expect(result.findings.map((finding) => finding.requirementId)).toEqual([
      "REQ-FAIL",
      "REQ-UNV",
    ]);
    expect(result.summary).toEqual({
      totalRequirements: 3,
      pass: 1,
      fail: 1,
      drift: 0,
      unverified: 1,
    });
  });

  it("assigns finding IDs deterministically by requirement ID", () => {
    const reqZ = requirement("REQ-Z", "high", "deterministic");
    const reqA = requirement("REQ-A", "critical", "deterministic");
    const result = runAggregate([reqZ, reqA]);

    expect(
      result.findings.map((finding) => ({
        id: finding.id,
        requirementId: finding.requirementId,
      })),
    ).toEqual([
      { id: "FND-001", requirementId: "REQ-A" },
      { id: "FND-002", requirementId: "REQ-Z" },
    ]);
    expect(result.requirementResults.map((item) => item.requirementId)).toEqual([
      "REQ-Z",
      "REQ-A",
    ]);
  });

  it("collects unmapped findings without dropping them", () => {
    const req = requirement("REQ-UNMAPPED", "medium", "deterministic");
    const result = runAggregate([req]);
    const finding = result.findings[0];

    expect(result.findings).toHaveLength(1);
    expect(finding?.path).toBeUndefined();
    expect(result.unmappedFindings).toHaveLength(1);
    expect(result.unmappedFindings[0]?.id).toBe(finding?.id);
  });

  it("sorts evidence IDs and uses the first record for path and lines", () => {
    const req = requirement("REQ-EV", "medium", "deterministic", [
      { type: "file_exists", path: "src/a.ts" },
    ]);
    const result = runAggregate(
      [req],
      new Map([[req.id, outcome("FAIL")]]),
      [],
      new Map([[req.id, ["EV-002", "EV-001"]]]),
      [evidence("EV-001", "src/a.ts"), evidence("EV-002", "src/b.ts")],
    );

    expect(result.requirementResults[0]?.evidenceIds).toEqual([
      "EV-001",
      "EV-002",
    ]);
    expect(result.findings[0]?.path).toBe("src/a.ts");
  });
});

describe("gate computation", () => {
  it("blocks on a critical FAIL", () => {
    const req = requirement("REQ-CRIT", "critical", "deterministic", [
      { type: "file_exists", path: "src/a.ts" },
    ]);
    const result = runAggregate(
      [req],
      new Map([[req.id, outcome("FAIL")]]),
    );

    expect(result.gate).toBe("BLOCKED");
  });

  it("blocks on a critical UNVERIFIED", () => {
    const req = requirement("REQ-CRIT", "critical", "deterministic");
    const result = runAggregate([req]);

    expect(result.gate).toBe("BLOCKED");
  });

  it("warns on a medium UNVERIFIED", () => {
    const req = requirement("REQ-MED", "medium", "deterministic");
    const result = runAggregate([req]);

    expect(result.gate).toBe("WARN");
  });

  it("passes when every requirement passes", () => {
    const req = requirement("REQ-OK", "high", "deterministic", [
      { type: "file_exists", path: "src/a.ts" },
    ]);
    const result = runAggregate(
      [req],
      new Map([[req.id, outcome("PASS")]]),
    );

    expect(result.gate).toBe("PASS");
  });
});

describe("run state", () => {
  it("is PARTIAL when a semantic assessment is missing and deterministic results exist", () => {
    const deterministic = requirement("REQ-DET", "low", "deterministic", [
      { type: "file_exists", path: "src/a.ts" },
    ]);
    const semantic = requirement("REQ-SEM", "medium", "semantic");
    const result = runAggregate(
      [deterministic, semantic],
      new Map([[deterministic.id, outcome("PASS")]]),
    );

    expect(result.runState).toBe("PARTIAL");
  });

  it("is COMPLETE when no semantic requirement is awaiting an assessment", () => {
    const deterministic = requirement("REQ-DET", "low", "deterministic", [
      { type: "file_exists", path: "src/a.ts" },
    ]);
    const result = runAggregate(
      [deterministic],
      new Map([[deterministic.id, outcome("PASS")]]),
    );

    expect(result.runState).toBe("COMPLETE");
  });
});

describe("operational safety", () => {
  it("never passes a requirement whose declared check has no result", () => {
    const req = requirement("REQ-MISSING", "high", "deterministic", [
      { type: "file_exists", path: "src/a.ts" },
    ]);
    const result = runAggregate([req]);

    expect(result.requirementResults[0]?.status).toBe("UNVERIFIED");
    expect(result.findings[0]?.reason).toBe(
      "Deterministic check result unavailable.",
    );
  });
});
