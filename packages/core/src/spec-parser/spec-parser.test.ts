import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseSpec } from "./spec-parser.js";

function fixtureSpec(name: "taskboard-regressed" | "taskboard-compliant"): string {
  return readFileSync(
    new URL(`../fixtures/${name}/PROJECT_SPEC.md`, import.meta.url),
    "utf8",
  );
}

function requirementBlock(
  id: string,
  options: {
    severityLine?: string;
    verificationLine?: string;
    descriptionLine?: string;
    checks?: string[];
  } = {},
): string {
  const lines = [`### ${id} — Requirement ${id}`, "- Description: A test requirement."];
  const checks = options.checks ?? ["  - type: file_exists", "    path: src/index.ts"];

  if (options.severityLine !== undefined) {
    lines.splice(1, 0, options.severityLine);
  } else {
    lines.splice(1, 0, "- Severity: critical");
  }

  if (options.verificationLine !== undefined) {
    lines.splice(2, 0, options.verificationLine);
  } else {
    lines.splice(2, 0, "- Verification: deterministic");
  }

  if (options.descriptionLine !== undefined) {
    lines[3] = options.descriptionLine;
  }

  lines.push("- Checks:", ...checks);

  return lines.join("\n");
}

describe.each(["taskboard-regressed", "taskboard-compliant"] as const)(
  "parseSpec %s fixture",
  (name) => {
    it("parses exactly the four declared requirements", () => {
      const result = parseSpec(fixtureSpec(name));

      expect(result.ok).toBe(true);

      if (!result.ok) {
        return;
      }

      expect(result.requirements.map((requirement) => requirement.id)).toEqual([
        "REQ-AUTH-001",
        "REQ-ERR-001",
        "REQ-PATH-001",
        "REQ-DEP-001",
      ]);
      expect(result.requirements.map((requirement) => requirement.severity)).toEqual([
        "critical",
        "medium",
        "high",
        "critical",
      ]);
      expect(result.requirements.map((requirement) => requirement.verificationMode)).toEqual([
        "semantic",
        "deterministic",
        "deterministic",
        "deterministic",
      ]);
      expect(result.requirements.map((requirement) => requirement.lineHint)).toEqual([5, 14, 23, 31]);
      expect(result.warnings).toEqual([]);
    });

    it("parses check fields correctly", () => {
      const result = parseSpec(fixtureSpec(name));

      expect(result.ok).toBe(true);

      if (!result.ok) {
        return;
      }

      const [auth, errorRequirement, pathRequirement, dependencyRequirement] =
        result.requirements;

      expect(auth?.checks).toEqual([
        {
          type: "text_contains",
          path: "src/app/api/projects/[id]/route.ts",
          text: "assertProjectOwner",
        },
      ]);
      expect(errorRequirement?.checks).toEqual([
        {
          type: "text_contains",
          path: "src/app/api/projects/[id]/route.ts",
          text: "catch (error)",
        },
      ]);
      expect(pathRequirement?.checks).toEqual([
        {
          type: "file_exists",
          path: "src/app/api/projects/[id]/route.ts",
        },
      ]);
      expect(dependencyRequirement?.checks).toEqual([
        {
          type: "dependency_absent",
          name: "shelljs",
        },
      ]);
    });
  },
);

describe("parseSpec errors", () => {
  it("rejects an empty specification", () => {
    const result = parseSpec("   \n\n");

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("empty_spec");
    }
  });

  it("rejects prose without requirement blocks", () => {
    const result = parseSpec("# Notes\n\nThere are no requirements here.\n");

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("no_requirements");
    }
  });

  it("rejects duplicate requirement IDs", () => {
    const spec = [
      requirementBlock("REQ-ONE-001"),
      "",
      requirementBlock("REQ-ONE-001"),
    ].join("\n");
    const result = parseSpec(spec);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("duplicate_requirement_id");
      expect(result.error.line).toBe(9);
    }
  });

  it("rejects unknown check types", () => {
    const spec = requirementBlock("REQ-ONE-001", {
      checks: ["  - type: magic_check", "    path: src/index.ts"],
    });
    const result = parseSpec(spec);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("unknown_check_type");
      expect(result.error.line).toBe(6);
    }
  });

  it("rejects a missing Severity field with a line number", () => {
    const spec = [
      "### REQ-ONE-001 — Missing severity",
      "- Verification: deterministic",
      "- Description: A requirement without severity.",
      "- Checks:",
      "  - type: file_exists",
      "    path: src/index.ts",
    ].join("\n");
    const result = parseSpec(spec);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("missing_required_field");
      expect(result.error.line).toBe(1);
    }
  });

  it("rejects invalid severities with a line number", () => {
    const result = parseSpec(requirementBlock("REQ-ONE-001", { severityLine: "- Severity: urgent" }));

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("invalid_severity");
      expect(result.error.line).toBe(2);
    }
  });

  it("rejects invalid verification modes", () => {
    const result = parseSpec(
      requirementBlock("REQ-ONE-001", { verificationLine: "- Verification: guess" }),
    );

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("invalid_verification_mode");
      expect(result.error.line).toBe(3);
    }
  });

  it("rejects a check item without a type declaration", () => {
    const spec = requirementBlock("REQ-ONE-001", {
      checks: ["  - path: src/index.ts"],
    });
    const result = parseSpec(spec);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("malformed_check_block");
      expect(result.error.line).toBe(6);
    }
  });

  it("rejects a check field that appears before a type declaration", () => {
    const spec = requirementBlock("REQ-ONE-001", {
      checks: ["    path: src/index.ts"],
    });
    const result = parseSpec(spec);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("malformed_check_block");
    }
  });
});

describe("parseSpec prose and fences", () => {
  it("preserves unstructured prose outside requirement blocks", () => {
    const spec = [
      "# Project",
      "",
      "Intro prose.",
      "",
      requirementBlock("REQ-ONE-001"),
      "",
      "## Notes",
      "",
      "Trailing prose.",
    ].join("\n");
    const result = parseSpec(spec);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.requirements).toHaveLength(1);
    expect(result.unstructuredProse).toContain("# Project");
    expect(result.unstructuredProse).toContain("Intro prose.");
    expect(result.unstructuredProse).toContain("## Notes");
    expect(result.unstructuredProse).toContain("Trailing prose.");
    expect(result.unstructuredProse).not.toContain("Requirement REQ-ONE-001");
  });

  it("does not parse requirement-like headings inside code fences", () => {
    const spec = [
      "# Project",
      "",
      "```md",
      "### REQ-FAKE-001 — Fake requirement",
      "- Severity: critical",
      "- Verification: deterministic",
      "- Description: This must not parse.",
      "- Checks:",
      "  - type: file_exists",
      "    path: src/fake.ts",
      "```",
      "",
      requirementBlock("REQ-REAL-001"),
    ].join("\n");
    const result = parseSpec(spec);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.requirements.map((requirement) => requirement.id)).toEqual(["REQ-REAL-001"]);
    expect(result.unstructuredProse).toContain("### REQ-FAKE-001 — Fake requirement");
  });

  it("rejects a specification whose only requirement is inside a code fence", () => {
    const spec = [
      "```md",
      "### REQ-FAKE-001 — Fake requirement",
      "- Severity: critical",
      "- Verification: deterministic",
      "- Description: This must not parse.",
      "- Checks:",
      "```",
    ].join("\n");
    const result = parseSpec(spec);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("no_requirements");
    }
  });

  it("records unknown requirement fields as warnings", () => {
    const spec = [
      requirementBlock("REQ-ONE-001"),
      "- Owner: platform-team",
    ].join("\n");
    const result = parseSpec(spec);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.line).toBe(8);
    expect(result.warnings[0]?.message).toContain("Owner");
  });
});
