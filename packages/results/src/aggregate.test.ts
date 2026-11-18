import { describe, expect, it } from "vitest";

import { attributionCell, AttributionSchema } from "@orivoxx/core";

import { DEFAULT_PASS_THRESHOLD, groupReliability, reliabilityProfile } from "./aggregate.js";
import { sampleResult } from "./samples.js";

function attributed(
  resultId: string,
  overall: number,
  layer: "harness" | "model" | "tool",
  mode: "recovery" | "execution",
  chaos: "none" | "tool_error" | "latency" | "context_pressure",
  createdAt: string,
) {
  const base = sampleResult({ resultId, createdAt, variant: overall < 70 ? "regressed" : "compliant" });

  return {
    ...base,
    overall,
    run: { ...base.run, status: "completed" as const },
    chaos: { kind: chaos, label: chaos, payloadSummary: "fixture" },
    attribution: AttributionSchema.parse({
      layer,
      mode,
      ruleId: "fixture",
      confidence: "high",
      evidence: [{ stepIndex: 2, kind: "tool_error", detail: "EACCES" }],
      proof: null,
      candidates: [],
    }),
    score: { ...base.score, overall },
  };
}

describe("reliability profile", () => {
  const rows = [
    attributed("res_agg0000000000000001", 97.3, "harness", "recovery", "none", "2026-11-18T10:00:00.000Z"),
    attributed("res_agg0000000000000002", 59.9, "harness", "recovery", "tool_error", "2026-11-18T10:01:00.000Z"),
    attributed("res_agg0000000000000003", 48.1, "model", "execution", "latency", "2026-11-18T10:02:00.000Z"),
    attributed("res_agg0000000000000004", 97.3, "harness", "recovery", "context_pressure", "2026-11-18T10:03:00.000Z"),
  ];

  it("computes mean, std, pass@k and layer distribution", () => {
    const profile = reliabilityProfile(rows);

    expect(profile.runs).toBe(4);
    expect(profile.passThreshold).toBe(DEFAULT_PASS_THRESHOLD);
    expect(profile.artifactScoreMean).toBe(75.6);
    expect(profile.artifactScoreStd).toBeGreaterThan(20);
    expect(profile.passAtK).toBe(0.5);
    expect(profile.layerDistribution).toEqual({
      spec: 0,
      model: 1,
      harness: 3,
      tool: 0,
      environment: 0,
    });
    expect(profile.chaosSensitivity).toEqual({
      none: 1,
      tool_error: 0,
      latency: 0,
      context_pressure: 1,
    });
  });

  it("groups by adapter and task", () => {
    const groups = groupReliability(rows);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.adapterId).toBe("fake");
    expect(groups[0]?.taskId).toBe("taskboard");
  });

  it("returns a neutral profile for no runs", () => {
    expect(reliabilityProfile([])).toMatchObject({
      runs: 0,
      artifactScoreMean: 0,
      artifactScoreStd: 0,
      passAtK: 0,
      trend: 0,
    });
  });

  it("names cells deterministically", () => {
    expect(attributionCell("harness", "recovery")).toBe("harness × recovery");
  });
});
