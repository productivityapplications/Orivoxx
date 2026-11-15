import { describe, expect, it } from "vitest";

import {
  BenchmarkResultSchema,
  buildBenchmarkResult,
  LeaderboardEntrySchema,
  tallyRequirements,
  toLeaderboardEntry,
} from "./contracts.js";
import { sampleResult, sampleScore } from "./samples.js";

const COMPLIANT = sampleResult({
  resultId: "res_aaaaaaaaaaaaaaaaaaaaaaaa",
  createdAt: "2026-11-15T10:00:00.000Z",
});

describe("benchmark result contract", () => {
  it("round-trips a real fixture evaluation", () => {
    const parsed = BenchmarkResultSchema.parse(JSON.parse(JSON.stringify(COMPLIANT)));

    expect(parsed.overall).toBe(99.5);
    expect(parsed.taskId).toBe("taskboard");
    expect(parsed.tally).toEqual({ passed: 9, failed: 0, drifted: 0, unverified: 0 });
    expect(parsed.benches).toEqual({ spec: 100, security: 100, maintainability: 96.7 });
  });

  it("carries every leaderboard-valid version field", () => {
    for (const field of [
      "taskVersion",
      "rulesetVersion",
      "adapterVersion",
      "scoringConfigVersion",
      "repositoryFingerprint",
    ] as const) {
      expect(typeof COMPLIANT[field], field).toBe("string");
      expect(COMPLIANT[field].length, field).toBeGreaterThan(0);
    }
  });

  it("rejects a result missing a version field", () => {
    for (const field of [
      "taskVersion",
      "rulesetVersion",
      "adapterVersion",
      "scoringConfigVersion",
      "repositoryFingerprint",
    ]) {
      const copy: Record<string, unknown> = { ...COMPLIANT };
      delete copy[field];

      expect(BenchmarkResultSchema.safeParse(copy).success, field).toBe(false);
    }
  });

  it("rejects a denormalized score that disagrees with the scorecard", () => {
    expect(
      BenchmarkResultSchema.safeParse({ ...COMPLIANT, overall: 88 }).success,
    ).toBe(false);
    expect(
      BenchmarkResultSchema.safeParse({
        ...COMPLIANT,
        benches: { ...COMPLIANT.benches, spec: 12 },
      }).success,
    ).toBe(false);
  });

  it("rejects a tally that disagrees with the scorecard", () => {
    expect(
      BenchmarkResultSchema.safeParse({
        ...COMPLIANT,
        tally: { ...COMPLIANT.tally, passed: 8, failed: 1 },
      }).success,
    ).toBe(false);
  });

  it("rejects a task id that disagrees with the scorecard", () => {
    expect(
      BenchmarkResultSchema.safeParse({ ...COMPLIANT, taskId: "linkstash" }).success,
    ).toBe(false);
  });

  it("rejects a completed run with a non-zero exit code", () => {
    expect(
      BenchmarkResultSchema.safeParse({
        ...COMPLIANT,
        run: { ...COMPLIANT.run, exitCode: 2 },
      }).success,
    ).toBe(false);
  });

  it("rejects unknown top-level fields", () => {
    expect(
      BenchmarkResultSchema.safeParse({ ...COMPLIANT, source: "upload" }).success,
    ).toBe(false);
  });

  it("rejects a non-contract result id", () => {
    expect(
      BenchmarkResultSchema.safeParse({ ...COMPLIANT, resultId: "abc" }).success,
    ).toBe(false);
  });

  it("refuses to build a result from an invalid scorecard", () => {
    const score = sampleScore("taskboard", "compliant");

    expect(() =>
      buildBenchmarkResult({
        resultId: "res_bbbbbbbbbbbbbbbbbbbbbbbb",
        createdAt: "2026-11-15T10:00:00.000Z",
        adapter: { id: "fake", version: "1.0.0", label: "Fake", kind: "baseline" },
        model: null,
        run: { status: "completed", exitCode: 0, durationMs: 1 },
        score: { ...score, overall: score.overall + 1 },
        diff: {
          text: "",
          truncated: false,
          addedFiles: 0,
          removedFiles: 0,
          changedFiles: 0,
          totalAddedLines: 0,
          totalRemovedLines: 0,
          files: [],
        },
      }),
    ).toThrow();
  });

  it("counts each requirement status exactly once", () => {
    const score = sampleScore("taskboard", "regressed");

    expect(tallyRequirements(score)).toEqual({
      passed: score.requirements.filter((entry) => entry.status === "PASS").length,
      failed: score.requirements.filter((entry) => entry.status === "FAIL").length,
      drifted: score.requirements.filter((entry) => entry.status === "DRIFT").length,
      unverified: score.requirements.filter((entry) => entry.status === "UNVERIFIED").length,
    });
  });
});

describe("leaderboard projection", () => {
  it("projects only the bounded list fields", () => {
    const entry = toLeaderboardEntry(COMPLIANT);

    expect(LeaderboardEntrySchema.parse(entry)).toEqual(entry);
    expect(JSON.stringify(entry)).not.toContain("requirements");
    expect(JSON.stringify(entry).length).toBeLessThan(2_048);
  });
});
