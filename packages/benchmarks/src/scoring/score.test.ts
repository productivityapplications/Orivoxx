import { describe, expect, it } from "vitest";

import type { RequirementStatus } from "@orivoxx/core";

import { ScoreResultSchema, type StructuralMetrics } from "../contracts/score.js";
import type { TaskDefinition } from "../contracts/task.js";
import { buildTaskDefinition } from "../tasks/build.js";
import { TASKBOARD_TASK } from "../tasks/taskboard/index.js";
import { scoreRun, ScoreError, type ScoreOutcome } from "./score.js";

const FINGERPRINT = "a".repeat(64);

const METRICS: StructuralMetrics = {
  moduleCount: 6,
  importEdges: 4,
  dependencyCycles: 0,
  maxFanOut: 3,
  orphanModules: 1,
  orphanRatio: 0.167,
};

function allOutcomes(status: RequirementStatus = "PASS"): ScoreOutcome[] {
  return TASKBOARD_TASK.ruleset.requirements.map((requirement) => ({
    requirementId: requirement.id,
    status,
  }));
}

function withStatus(requirementId: string, status: RequirementStatus): ScoreOutcome[] {
  return allOutcomes().map((outcome) =>
    outcome.requirementId === requirementId ? { ...outcome, status } : outcome,
  );
}

function score(
  outcomes: ScoreOutcome[],
  overrides: {
    task?: TaskDefinition;
    metrics?: StructuralMetrics;
    adapterVersion?: string;
    repositoryFingerprint?: string;
  } = {},
) {
  return scoreRun({
    task: overrides.task ?? TASKBOARD_TASK,
    outcomes,
    metrics: overrides.metrics ?? METRICS,
    adapterVersion: overrides.adapterVersion ?? "1.0.0",
    repositoryFingerprint: overrides.repositoryFingerprint ?? FINGERPRINT,
  });
}

describe("deterministic score", () => {
  it("awards full bench scores when every requirement passes", () => {
    const result = score(allOutcomes());

    expect(result.benches.spec.score).toBe(100);
    expect(result.benches.security.score).toBe(100);
    expect(result.overall).toBeGreaterThan(95);
    expect(result.capsApplied).toEqual([]);
    expect(result.appliedCap).toBeNull();
  });

  it("is byte-identical across calls", () => {
    const first = JSON.stringify(score(allOutcomes()));
    const second = JSON.stringify(score(allOutcomes()));

    expect(second).toBe(first);
  });

  it("keeps the version fields on the result", () => {
    const result = score(allOutcomes());

    expect(result.taskVersion).toBe(TASKBOARD_TASK.manifest.version);
    expect(result.rulesetVersion).toBe(TASKBOARD_TASK.ruleset.version);
    expect(result.scoringConfigVersion).toBe(TASKBOARD_TASK.scoringConfig.version);
    expect(result.adapterVersion).toBe("1.0.0");
    expect(result.repositoryFingerprint).toBe(FINGERPRINT);
  });

  it("sorts requirements by id", () => {
    const result = score(allOutcomes());
    const ids = result.requirements.map((requirement) => requirement.id);

    expect(ids).toEqual([...ids].sort());
  });
});

describe("status handling", () => {
  it("treats a missing outcome as UNVERIFIED and never as a pass", () => {
    const outcomes = allOutcomes().filter(
      (outcome) => outcome.requirementId !== "REQ-TASKS-001",
    );
    const result = score(outcomes);
    const requirement = result.requirements.find(
      (entry) => entry.id === "REQ-TASKS-001",
    );

    expect(requirement?.status).toBe("UNVERIFIED");
    expect(requirement?.earned).toBe(0);
    expect(result.unverifiedRequirementIds).toContain("REQ-TASKS-001");
    expect(result.benches.spec.score).toBeLessThan(100);
  });

  it("earns zero for UNVERIFIED and does not trigger a critical cap", () => {
    const result = score(withStatus("REQ-AUTH-001", "UNVERIFIED"));
    const unverified = result.requirements.find(
      (requirement) => requirement.id === "REQ-AUTH-001",
    );

    expect(unverified?.earned).toBe(0);
    expect(result.capsApplied).toEqual([]);
    expect(result.unverifiedRequirementIds).toContain("REQ-AUTH-001");
  });

  it("counts status categories per bench", () => {
    const result = score(withStatus("REQ-ERR-001", "UNVERIFIED"));

    expect(result.benches.spec.passed).toBe(
      TASKBOARD_TASK.ruleset.requirements.filter(
        (requirement) =>
          requirement.bench === "spec" && requirement.id !== "REQ-ERR-001",
      ).length,
    );
    expect(result.benches.spec.unverified).toBe(1);
  });

  it("rejects an unknown requirement id", () => {
    expect(() =>
      score([...allOutcomes(), { requirementId: "REQ-UNKNOWN-001", status: "PASS" }]),
    ).toThrow(ScoreError);
  });

  it("rejects a duplicate requirement outcome", () => {
    expect(() =>
      score([...allOutcomes(), { requirementId: "REQ-AUTH-001", status: "FAIL" }]),
    ).toThrow(/Duplicate outcome/);
  });
});

describe("caps", () => {
  it("caps a critical spec failure at 59.9", () => {
    const result = score(withStatus("REQ-AUTH-001", "FAIL"));

    expect(result.benches.spec.score).toBeLessThan(100);
    expect(result.capsApplied).toEqual(["critical-spec-failure"]);
    expect(result.appliedCap).toBe(59.9);
    expect(result.overall).toBeLessThanOrEqual(59.9);
  });

  it("caps a critical security failure at 49.9", () => {
    const result = score(withStatus("REQ-SEC-002", "FAIL"));

    expect(result.capsApplied).toEqual(["critical-security-failure"]);
    expect(result.appliedCap).toBe(49.9);
    expect(result.overall).toBeLessThanOrEqual(49.9);
  });

  it("applies the stricter cap when both critical benches fail", () => {
    const outcomes = withStatus("REQ-SEC-002", "FAIL").map((outcome) =>
      outcome.requirementId === "REQ-AUTH-001"
        ? { ...outcome, status: "FAIL" as const }
        : outcome,
    );
    const result = score(outcomes);

    expect(result.capsApplied).toEqual([
      "critical-spec-failure",
      "critical-security-failure",
    ]);
    expect(result.appliedCap).toBe(49.9);
    expect(result.overall).toBeLessThanOrEqual(49.9);
  });
});

describe("weight configuration", () => {
  it("uses severity weights from the task scoring config", () => {
    const task: TaskDefinition = {
      ...TASKBOARD_TASK,
      scoringConfig: {
        ...TASKBOARD_TASK.scoringConfig,
        severityWeights: { critical: 1, high: 1, medium: 1, low: 1 },
      },
    };
    const uniform = score(withStatus("REQ-ERR-001", "FAIL"), { task });
    const weighted = score(withStatus("REQ-ERR-001", "FAIL"));

    expect(uniform.benches.spec.score).not.toBe(weighted.benches.spec.score);
  });

  it("uses bench weights from the task scoring config", () => {
    const task: TaskDefinition = {
      ...TASKBOARD_TASK,
      scoringConfig: {
        ...TASKBOARD_TASK.scoringConfig,
        benchWeights: { spec: 0, security: 0, maintainability: 1 },
      },
    };
    const result = score(allOutcomes(), { task });

    expect(result.overall).toBe(result.benches.maintainability.score);
  });
});

describe("version enforcement", () => {
  it("rejects a non-semver adapter version", () => {
    expect(() => score(allOutcomes(), { adapterVersion: "latest" })).toThrow(
      /semantic version/,
    );
  });

  it("rejects an invalid repository fingerprint", () => {
    expect(() =>
      score(allOutcomes(), { repositoryFingerprint: "not-a-fingerprint" }),
    ).toThrow(/SHA-256/);
  });

  it("rejects a result missing a required version field", () => {
    const result = score(allOutcomes());
    const withoutConfig: Record<string, unknown> = { ...result };
    delete withoutConfig.scoringConfigVersion;

    expect(ScoreResultSchema.safeParse(withoutConfig).success).toBe(false);
  });

  it("rejects a task with an empty bench at score time", () => {
    const spec = `# Minimal task

## Requirements

### REQ-ONLY-001 — A file exists
- Severity: high
- Verification: deterministic
- Description: The package manifest must exist.
- Checks:
  - type: file_exists
    path: package.json
`;
    const task = buildTaskDefinition({
      manifest: {
        ...TASKBOARD_TASK.manifest,
        id: "minimal-task",
        title: "Minimal task",
        startingFiles: [{ path: "PROJECT_SPEC.md", content: spec }],
        requirementBenches: { "REQ-ONLY-001": "spec" },
      },
      specText: spec,
      scoringConfig: TASKBOARD_TASK.scoringConfig,
    });

    expect(() =>
      score([{ requirementId: "REQ-ONLY-001", status: "PASS" }], { task }),
    ).toThrow(/security bench has no requirements/);
  });
});
