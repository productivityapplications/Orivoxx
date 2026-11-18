import { describe, expect, it } from "vitest";

import {
  evaluateRepository,
  getTask,
  getTaskFixtures,
  normalizeProjectFiles,
} from "@orivoxx/benchmarks";

import { replay, replayBaseline } from "./index.js";

const task = getTask("taskboard");
const fixtures = getTaskFixtures("taskboard");

if (fixtures === undefined) {
  throw new Error("TaskBoard fixtures are missing.");
}

const actions = fixtures.compliant.map((file, index) => ({
  stepIndex: index + 1,
  toolName: "write_file",
  path: file.path,
  content: file.content,
}));

const targetStep =
  actions.find((action) => action.path.includes("projects"))?.stepIndex ?? 1;

function baselineWithout(step: number) {
  const files = actions
    .filter((action) => action.stepIndex !== step)
    .map((action) => ({ path: action.path, content: action.content }));

  return evaluateRepository({
    task,
    files: normalizeProjectFiles(files),
    adapterVersion: "1.0.0",
  }).score.overall;
}

describe("counterfactual replay", () => {
  it("reproduces the baseline exactly with no intervention", () => {
    const files = fixtures.compliant.map((file) => ({ path: file.path, content: file.content }));
    const expected = evaluateRepository({
      task,
      files: normalizeProjectFiles(files),
      adapterVersion: "1.0.0",
    }).score.overall;

    const outcome = replayBaseline({
      task,
      actions,
      baseline: { overall: expected, exitReason: "completed" },
    });

    expect(outcome.overall).toBe(expected);
    expect(outcome.passed).toBe(true);
  });

  it("proves a retry policy crosses the threshold", () => {
    const baseline = baselineWithout(targetStep);

    expect(baseline).toBeLessThan(70);

    const result = replay({
      task,
      actions,
      baseline: { overall: baseline, exitReason: "failed" },
      failedSteps: [targetStep],
      intervention: {
        kind: "retry_policy",
        stepIndex: targetStep,
        summary: "retry the failed write once",
      },
    });

    expect(result.outcome.overall).toBeGreaterThanOrEqual(70);
    expect(result.outcome.passed).toBe(true);
    expect(result.outcome.divergenceStep).toBe(targetStep);
    expect(result.outcome.replayedSteps).toBeGreaterThan(0);
    expect(result.files.some((file) => file.path.includes("projects"))).toBe(true);
  });

  it("reports an insufficient intervention honestly", () => {
    const result = replay({
      task,
      actions: actions.filter((action) => action.stepIndex !== targetStep),
      baseline: { overall: baselineWithout(targetStep), exitReason: "failed" },
      failedSteps: [targetStep],
      intervention: {
        kind: "stop_policy",
        stepIndex: targetStep,
        summary: "continue without the missing action",
      },
    });

    expect(result.outcome.passed).toBe(false);
    expect(result.outcome.sufficient).toBe(false);
  });

  it("supports an action replacement at the divergence point", () => {
    const replacement = actions.find((action) => action.stepIndex === targetStep);

    if (replacement === undefined) {
      throw new Error("No replacement action.");
    }

    const result = replay({
      task,
      actions: actions.filter((action) => action.stepIndex !== targetStep),
      baseline: { overall: baselineWithout(targetStep), exitReason: "failed" },
      failedSteps: [targetStep],
      intervention: {
        kind: "action_replacement",
        stepIndex: targetStep,
        summary: "replace the action with the recorded content",
      },
      replacement: { path: replacement.path, content: replacement.content },
    });

    expect(result.outcome.passed).toBe(true);
    expect(result.outcome.divergenceStep).toBe(targetStep);
  });

  it("is deterministic", () => {
    const input = {
      task,
      actions,
      baseline: { overall: baselineWithout(targetStep), exitReason: "failed" as const },
      failedSteps: [targetStep],
      intervention: {
        kind: "retry_policy" as const,
        stepIndex: targetStep,
        summary: "retry once",
      },
    };
    const first = replay(input);
    const second = replay(input);

    expect(second.outcome).toEqual(first.outcome);
    expect(second.files).toEqual(first.files);
  });
});
