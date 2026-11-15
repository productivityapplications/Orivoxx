import { describe, expect, it } from "vitest";

import { normalizeProjectFiles } from "../files.js";
import { getTaskFixtures, TASKBOARD_TASK } from "../tasks/index.js";
import { evaluateRepository } from "./evaluate.js";

function evaluate(variant: "compliant" | "regressed") {
  const fixtures = getTaskFixtures("taskboard");

  if (fixtures === undefined) {
    throw new Error("TaskBoard fixtures are missing.");
  }

  return evaluateRepository({
    task: TASKBOARD_TASK,
    files: normalizeProjectFiles(fixtures[variant]),
    adapterVersion: "1.0.0",
  });
}

describe("repository evaluation", () => {
  it("scores every requirement of the compliant fixture as PASS", () => {
    const evaluation = evaluate("compliant");

    expect(evaluation.outcomes.every((outcome) => outcome.status === "PASS")).toBe(true);
    expect(evaluation.score.benches.spec.score).toBe(100);
    expect(evaluation.score.benches.security.score).toBe(100);
    expect(evaluation.score.capsApplied).toEqual([]);
  });

  it("fails the intended requirements of the regressed fixture", () => {
    const evaluation = evaluate("regressed");
    const statuses = Object.fromEntries(
      evaluation.outcomes.map((outcome) => [outcome.requirementId, outcome.status]),
    );

    expect(statuses["REQ-AUTH-001"]).toBe("FAIL");
    expect(statuses["REQ-ERR-001"]).toBe("FAIL");
    expect(statuses["REQ-PATH-001"]).toBe("PASS");
    expect(statuses["REQ-SEC-002"]).toBe("PASS");
  });

  it("caps the regressed fixture at the critical spec cap", () => {
    const evaluation = evaluate("regressed");

    expect(evaluation.score.capsApplied).toEqual(["critical-spec-failure"]);
    expect(evaluation.score.appliedCap).toBe(59.9);
    expect(evaluation.score.overall).toBeLessThanOrEqual(59.9);
  });

  it("scores the compliant fixture above the regressed fixture", () => {
    expect(evaluate("compliant").score.overall).toBeGreaterThan(
      evaluate("regressed").score.overall,
    );
  });

  it("is byte-identical across evaluations", () => {
    const first = JSON.stringify(evaluate("compliant").score);
    const second = JSON.stringify(evaluate("compliant").score);

    expect(second).toBe(first);
  });

  it("records a repository fingerprint that differs between fixtures", () => {
    expect(evaluate("compliant").score.repositoryFingerprint).not.toBe(
      evaluate("regressed").score.repositoryFingerprint,
    );
  });
});
