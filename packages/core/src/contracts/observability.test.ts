import { describe, expect, it } from "vitest";

import {
  TRACE_LIMITS,
  TraceEventSchema,
  TraceSchema,
  deriveRunMetrics,
  traceSizeBytes,
  type TraceEvent,
} from "./observability.js";

const AT = "2026-11-18T10:00:00.000Z";

function event(partial: Record<string, unknown>): TraceEvent {
  return TraceEventSchema.parse(partial);
}

const trace: TraceEvent[] = [
  event({
    type: "run_started",
    at: AT,
    runId: "123e4567-e89b-42d3-a456-426614174000",
    adapter: { id: "python-openrouter", version: "1.0.0" },
    taskVersion: "1.0.0",
    rulesetVersion: "1.0.0",
    scoringConfigVersion: "1.0.0",
    model: { provider: "openrouter", name: "openai/gpt-4o-mini" },
    startTime: AT,
    runIndex: 0,
  }),
  event({
    type: "model_call_finished",
    at: AT,
    stepIndex: 1,
    durationMs: 900,
    promptTokens: 100,
    completionTokens: 20,
    costUsd: 0.0001,
    finishReason: "stop",
  }),
  event({
    type: "tool_call_started",
    at: AT,
    stepIndex: 1,
    toolName: "write_file",
    argsRedacted: "path=src/a.ts bytes=20",
    redacted: true,
  }),
  event({
    type: "tool_call_finished",
    at: AT,
    stepIndex: 1,
    toolName: "write_file",
    durationMs: 3,
    status: "error",
    resultRedacted: "EACCES",
    errorClass: "EACCES",
    redacted: true,
  }),
  event({ type: "step_completed", at: AT, stepIndex: 1, durationMs: 910 }),
  event({
    type: "run_finished",
    at: AT,
    endTime: AT,
    exitReason: "failed",
    totals: {
      steps: 1,
      toolCalls: 1,
      promptTokens: 100,
      completionTokens: 20,
      totalTokens: 120,
      costUsd: 0.0001,
      durationMs: 1200,
    },
  }),
];

describe("trace contracts", () => {
  it("parses every event and derives metrics", () => {
    expect(TraceSchema.parse(trace)).toHaveLength(6);

    expect(deriveRunMetrics(trace)).toEqual({
      steps: 1,
      toolCalls: 1,
      toolErrorRate: 1,
      promptTokens: 100,
      completionTokens: 20,
      totalTokens: 120,
      costUsd: 0.0001,
      durationMs: 1200,
      exitReason: "failed",
    });
  });

  it("rejects unknown fields and content-bearing tool events", () => {
    expect(() =>
      TraceEventSchema.parse({
        type: "tool_call_started",
        at: AT,
        stepIndex: 1,
        toolName: "write_file",
        argsRedacted: "path=src/a.ts",
        redacted: true,
        content: "secret source",
      }),
    ).toThrow();
  });

  it("requires the redacted marker on summarized fields", () => {
    expect(() =>
      TraceEventSchema.parse({
        type: "tool_call_finished",
        at: AT,
        stepIndex: 1,
        toolName: "write_file",
        durationMs: 1,
        status: "ok",
        resultRedacted: "ok",
        errorClass: null,
        redacted: false,
      }),
    ).toThrow();
  });

  it("bounds the trace and its serialized size", () => {
    expect(TRACE_LIMITS.maxEvents).toBe(500);
    expect(traceSizeBytes(trace)).toBeLessThan(TRACE_LIMITS.maxSerializedBytes);
    expect(() =>
      TraceSchema.parse(
        Array.from({ length: TRACE_LIMITS.maxEvents + 1 }, () =>
          event({ type: "step_completed", at: AT, stepIndex: 1, durationMs: 1 }),
        ),
      ),
    ).toThrow();
  });

  it("falls back to event sums when run_finished is missing", () => {
    const metrics = deriveRunMetrics(trace.slice(0, 5));

    expect(metrics.exitReason).toBe("error");
    expect(metrics.totalTokens).toBe(120);
    expect(metrics.toolErrorRate).toBe(1);
    expect(metrics.durationMs).toBe(0);
  });

  it("does not store prompt text or model output", () => {
    const serialized = JSON.stringify(trace);

    expect(serialized).not.toContain("messages");
    expect(serialized).not.toContain("content");
    expect(serialized).not.toContain("sk-or-v1-");
  });
});
