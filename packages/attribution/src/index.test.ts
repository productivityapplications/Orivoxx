import { describe, expect, it } from "vitest";

import { getTask } from "@orivoxx/benchmarks";
import {
  AttributionResultSchema,
  TraceEventSchema,
  type TraceEvent,
} from "@orivoxx/core";
import { sampleScore } from "@orivoxx/results";

import { attributeRun } from "./index.js";

const AT = "2026-11-18T10:00:00.000Z";
const task = getTask("taskboard");
const regressed = sampleScore("taskboard", "regressed");

function ev(partial: Record<string, unknown>): TraceEvent {
  return TraceEventSchema.parse(partial);
}

function finished(exitReason: string, steps = 3): TraceEvent {
  return ev({
    type: "run_finished",
    at: AT,
    endTime: AT,
    exitReason,
    totals: {
      steps,
      toolCalls: 1,
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      costUsd: 0.001,
      durationMs: 100,
    },
  });
}

function tool(step: number, status: "ok" | "error", result: string): TraceEvent[] {
  return [
    ev({
      type: "tool_call_started",
      at: AT,
      stepIndex: step,
      toolName: "write_file",
      argsRedacted: `path=src/${step}.ts bytes=10`,
      redacted: true,
    }),
    ev({
      type: "tool_call_finished",
      at: AT,
      stepIndex: step,
      toolName: "write_file",
      durationMs: 2,
      status,
      resultRedacted: result,
      errorClass: status === "error" ? "EACCES" : null,
      redacted: true,
    }),
  ];
}

function model(step: number, finishReason = "stop"): TraceEvent {
  return ev({
    type: "model_call_finished",
    at: AT,
    stepIndex: step,
    durationMs: 100,
    promptTokens: 10,
    completionTokens: 5,
    costUsd: 0.001,
    finishReason,
  });
}

interface Fixture {
  name: string;
  trace: TraceEvent[];
  score?: typeof regressed;
  previous?: number[];
  expected: string;
}

const fixtures: Fixture[] = [
  {
    name: "tool_error_unhandled",
    trace: [...tool(1, "error", "EACCES"), finished("failed")],
    expected: "harness × recovery",
  },
  {
    name: "tool_error_retried_gave_up",
    trace: [...tool(1, "error", "EACCES"), ...tool(2, "error", "EACCES"), finished("failed", 2)],
    expected: "tool × execution",
  },
  {
    name: "step_limit_hit",
    trace: [model(1), finished("step_limit", 12)],
    expected: "harness × execution",
  },
  {
    name: "token_limit_hit",
    trace: [model(1, "length"), finished("completed")],
    expected: "harness × execution",
  },
  {
    name: "adapter_error_after_model_call",
    trace: [model(1), finished("failed", 1)],
    expected: "harness × execution",
  },
  {
    name: "zero_edit_then_fail",
    trace: [finished("completed", 1)],
    expected: "spec × decision",
  },
  {
    name: "flaky_across_runs",
    trace: [...tool(1, "ok", "ok bytes=10"), finished("completed")],
    previous: [97, 98],
    expected: "environment × decision",
  },
  {
    name: "ignored_contradiction",
    trace: [...tool(1, "ok", "mismatch in returned balances"), model(2), finished("failed")],
    expected: "model × detection",
  },
  {
    name: "hallucinated_api",
    trace: [...tool(1, "ok", "module not found: left-pad"), finished("failed")],
    expected: "model × decision",
  },
  {
    name: "tool_returned_garbage",
    trace: [...tool(1, "ok", "bytes=0"), finished("failed")],
    expected: "tool × execution",
  },
  {
    name: "dropped_tool_result",
    trace: [...tool(1, "ok", "ok bytes=10"), finished("failed")],
    expected: "harness × execution",
  },
  {
    name: "misleading_spec_followed",
    trace: [...tool(1, "ok", "ok bytes=10"), finished("completed")],
    expected: "spec × detection",
  },
];

describe("attribution rule engine", () => {
  it("names every labeled fixture correctly (fixture precision and recall)", () => {
    let correct = 0;
    let attributed = 0;
    const misses: string[] = [];

    for (const fixture of fixtures) {
      const result = attributeRun({
        trace: fixture.trace,
        score: fixture.score ?? regressed,
        task,
        previousScores: fixture.previous,
      });

      AttributionResultSchema.parse(result);

      if (result.attribution !== null) {
        attributed += 1;

        const cell = `${result.attribution.layer} × ${result.attribution.mode}`;

        if (cell === fixture.expected) {
          correct += 1;
        } else {
          misses.push(`${fixture.name}: ${cell} != ${fixture.expected}`);
        }
      } else {
        misses.push(`${fixture.name}: unattributed (${result.reason})`);
      }
    }

    expect(misses).toEqual([]);
    expect(correct).toBe(fixtures.length);
    expect(attributed).toBe(fixtures.length);
    expect(correct / attributed).toBe(1); // precision on labeled fixtures
    expect(correct / fixtures.length).toBe(1); // recall on labeled fixtures
  });

  it("returns unavailable when no trace exists", () => {
    const result = attributeRun({ trace: [], score: regressed, task });

    expect(result.status).toBe("unavailable");
    expect(result.reason).toBe("trace_unavailable");
  });

  it("never attributes a passing run", () => {
    const result = attributeRun({
      trace: [...tool(1, "ok", "ok bytes=10"), finished("completed")],
      score: sampleScore("taskboard", "compliant"),
      task,
    });

    expect(result.status).toBe("unattributed");
    expect(result.attribution).toBeNull();
  });

  it("is deterministic and evidence-bearing", () => {
    const input = {
      trace: [...tool(1, "ok", "ok bytes=10"), finished("completed")],
      score: regressed,
      task,
    };
    const first = attributeRun(input);
    const second = attributeRun(input);

    expect(second).toEqual(first);
    expect(first.attribution?.evidence.length).toBeGreaterThan(0);
    expect(first.attribution?.proof).toBeNull();
  });

  it("does not invent a cell when no rule matches", () => {
    const noFailedSpec = {
      ...regressed,
      requirements: regressed.requirements.map((requirement) => ({
        ...requirement,
        status: "PASS" as const,
        earned: requirement.weight,
      })),
    };
    const result = attributeRun({
      trace: [...tool(1, "ok", "ok bytes=10"), finished("completed")],
      score: noFailedSpec,
      task,
      previousScores: [60, 60.2, 60.1],
    });

    expect(result.status).toBe("unattributed");
    expect(result.reason).toContain("not attributable");
  });
});
