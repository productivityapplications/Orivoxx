import {
  AttributionResultSchema,
  type AttributionEvidence,
  type AttributionLayer,
  type AttributionMode,
  type AttributionResult,
  type ChaosMetadata,
  type TraceEvent,
} from "@orivoxx/core";
import type { ScoreResult, TaskDefinition } from "@orivoxx/benchmarks";

export const DEFAULT_PASS_THRESHOLD = 70;

export interface AttributionInput {
  trace: readonly TraceEvent[];
  score: ScoreResult;
  task: TaskDefinition;
  chaos?: ChaosMetadata;
  passThreshold?: number;
  /** Previous overall scores for the same adapter/task/model, oldest first. */
  previousScores?: readonly number[];
}

interface Candidate {
  layer: AttributionLayer;
  mode: AttributionMode;
  ruleId: string;
  evidence: AttributionEvidence[];
}

function toolEvents(trace: readonly TraceEvent[]) {
  return trace.filter(
    (event) => event.type === "tool_call_started" || event.type === "tool_call_finished",
  );
}

function finishedRun(trace: readonly TraceEvent[]) {
  const event = [...trace].reverse().find((entry) => entry.type === "run_finished");
  return event?.type === "run_finished" ? event : null;
}

function ruleRetriedGaveUp(trace: readonly TraceEvent[]): Candidate | null {
  const failed = trace.filter(
    (event) => event.type === "tool_call_finished" && event.status !== "ok",
  );

  if (failed.length < 2) {
    return null;
  }

  const byTool = new Map<string, number[]>();

  for (const event of failed) {
    if (event.type !== "tool_call_finished") {
      continue;
    }

    const bucket = byTool.get(event.toolName) ?? [];
    bucket.push(event.stepIndex);
    byTool.set(event.toolName, bucket);
  }

  for (const [toolName, steps] of byTool) {
    if (steps.length >= 2) {
      return {
        layer: "tool",
        mode: "execution",
        ruleId: "tool_error_retried_gave_up",
        evidence: steps.map((stepIndex) => ({
          stepIndex,
          kind: "tool_error" as const,
          detail: `${toolName} failed on ${steps.length} attempts without a success`,
        })),
      };
    }
  }

  return null;
}

function ruleToolErrorUnhandled(trace: readonly TraceEvent[]): Candidate | null {
  const failed = trace.filter(
    (event) => event.type === "tool_call_finished" && event.status !== "ok",
  );

  if (failed.length === 0) {
    return null;
  }

  const first = failed[0];

  if (first?.type !== "tool_call_finished") {
    return null;
  }

  const retry = trace.some(
    (event) =>
      event.type === "tool_call_started" &&
      event.toolName === first.toolName &&
      event.stepIndex > first.stepIndex &&
      first.argsRedacted !== undefined &&
      event.argsRedacted === first.argsRedacted,
  );

  if (retry) {
    return null;
  }

  return {
    layer: "harness",
    mode: "recovery",
    ruleId: "tool_error_unhandled",
    evidence: [
      {
        stepIndex: first.stepIndex,
        kind: "tool_error",
        detail: `${first.toolName} → ${first.resultRedacted}; no retry before exit`,
      },
    ],
  };
}

function ruleStepLimit(trace: readonly TraceEvent[]): Candidate | null {
  const finished = finishedRun(trace);

  if (finished?.exitReason !== "step_limit") {
    return null;
  }

  return {
    layer: "harness",
    mode: "execution",
    ruleId: "step_limit_hit",
    evidence: [
      {
        stepIndex: finished.totals.steps || 1,
        kind: "exit",
        detail: "run_finished exitReason=step_limit before the plan completed",
      },
    ],
  };
}

function ruleTokenLimit(trace: readonly TraceEvent[]): Candidate | null {
  const finished = finishedRun(trace);
  const lengthStop = trace.find(
    (event) => event.type === "model_call_finished" && event.finishReason === "length",
  );

  if (finished?.exitReason !== "token_limit" && lengthStop === undefined) {
    return null;
  }

  return {
    layer: "harness",
    mode: "execution",
    ruleId: "token_limit_hit",
    evidence: [
      {
        stepIndex: lengthStop !== undefined && "stepIndex" in lengthStop ? lengthStop.stepIndex : 1,
        kind: "model_call",
        detail: "model hit the completion budget before the run finished",
      },
    ],
  };
}

function ruleAdapterErrorAfterModelCall(trace: readonly TraceEvent[]): Candidate | null {
  const finished = finishedRun(trace);

  if (finished === null || finished.exitReason === "completed") {
    return null;
  }

  const modelCalls = trace.filter((event) => event.type === "model_call_finished");
  const tools = toolEvents(trace);
  const lastModel = modelCalls.at(-1);

  if (lastModel === undefined || tools.length > 0) {
    return null;
  }

  const modelFault =
    lastModel.type === "model_call_finished" &&
    (lastModel.finishReason === "content_filter" || lastModel.finishReason === "error");

  return {
    layer: modelFault ? "model" : "harness",
    mode: "execution",
    ruleId: "adapter_error_after_model_call",
    evidence: [
      {
        stepIndex: lastModel.stepIndex,
        kind: "model_call",
        detail: `model call finished (${lastModel.finishReason}) and the run exited ${finished.exitReason} before any tool call`,
      },
    ],
  };
}

function ruleZeroEdit(trace: readonly TraceEvent[], passed: boolean): Candidate | null {
  if (passed) {
    return null;
  }

  const successful = trace.filter(
    (event) => event.type === "tool_call_finished" && event.status === "ok",
  );

  if (successful.length > 0) {
    return null;
  }

  return {
    layer: "spec",
    mode: "decision",
    ruleId: "zero_edit_then_fail",
    evidence: [
      {
        stepIndex: null,
        kind: "spec",
        detail: "run completed no successful edits and scored below the pass threshold",
      },
    ],
  };
}

function ruleFlaky(
  score: ScoreResult,
  previousScores: readonly number[] | undefined,
  hasTraceFault: boolean,
): Candidate | null {
  if (hasTraceFault || previousScores === undefined || previousScores.length < 2) {
    return null;
  }

  const spread = Math.max(...previousScores, score.overall) - Math.min(...previousScores, score.overall);

  if (spread < 10) {
    return null;
  }

  return {
    layer: "environment",
    mode: "decision",
    ruleId: "flaky_across_runs",
    evidence: [
      {
        stepIndex: null,
        kind: "nondeterminism",
        detail: `same adapter/task/model scores span ${spread.toFixed(1)} points across runs`,
      },
    ],
  };
}

function ruleIgnoredContradiction(trace: readonly TraceEvent[]): Candidate | null {
  const contradiction = trace.find(
    (event) =>
      event.type === "tool_call_finished" &&
      /contradict|mismatch|inconsistent|unexpected/i.test(event.resultRedacted),
  );

  if (contradiction?.type !== "tool_call_finished") {
    return null;
  }

  return {
    layer: "model",
    mode: "detection",
    ruleId: "ignored_contradiction",
    evidence: [
      {
        stepIndex: contradiction.stepIndex,
        kind: "contradiction",
        detail: `tool returned "${contradiction.resultRedacted}" and the run continued`,
      },
    ],
  };
}

function ruleHallucinatedApi(trace: readonly TraceEvent[]): Candidate | null {
  const hit = trace.find((event) => {
    if (event.type !== "tool_call_finished") {
      return false;
    }

    return /module.?not.?found|not declared|undefined import|unknown package/i.test(
      `${event.resultRedacted} ${event.errorClass ?? ""}`,
    );
  });

  if (hit?.type !== "tool_call_finished") {
    return null;
  }

  return {
    layer: "model",
    mode: "decision",
    ruleId: "hallucinated_api",
    evidence: [
      {
        stepIndex: hit.stepIndex,
        kind: "tool_result",
        detail: `tool reported ${hit.resultRedacted}; the produced import was not declared`,
      },
    ],
  };
}

function ruleDroppedToolResult(trace: readonly TraceEvent[]): Candidate | null {
  const finished = finishedRun(trace);

  if (finished === null || finished.exitReason === "completed") {
    return null;
  }

  const successful = trace.filter(
    (event) => event.type === "tool_call_finished" && event.status === "ok",
  );
  const last = successful.at(-1);

  if (last?.type !== "tool_call_finished") {
    return null;
  }

  const laterSteps = trace.filter(
    (event) => "stepIndex" in event && event.stepIndex > last.stepIndex,
  );

  if (laterSteps.length > 0) {
    return null;
  }

  return {
    layer: "harness",
    mode: "execution",
    ruleId: "dropped_tool_result",
    evidence: [
      {
        stepIndex: last.stepIndex,
        kind: "tool_result",
        detail: `${last.toolName} succeeded but no later step used the result before exit`,
      },
    ],
  };
}

function ruleToolReturnedGarbage(trace: readonly TraceEvent[]): Candidate | null {
  const hit = trace.find(
    (event) =>
      event.type === "tool_call_finished" &&
      event.status === "ok" &&
      /bytes=0|invalid|empty|garbage/i.test(event.resultRedacted),
  );

  if (hit?.type !== "tool_call_finished") {
    return null;
  }

  return {
    layer: "tool",
    mode: "execution",
    ruleId: "tool_returned_garbage",
    evidence: [
      {
        stepIndex: hit.stepIndex,
        kind: "tool_result",
        detail: `${hit.toolName} returned "${hit.resultRedacted}" for a required artifact`,
      },
    ],
  };
}

function ruleMisleadingSpec(
  score: ScoreResult,
  passed: boolean,
): Candidate | null {
  if (passed) {
    return null;
  }

  const failed = score.requirements.filter(
    (requirement) => requirement.status === "FAIL" && requirement.bench === "spec",
  );

  if (failed.length === 0) {
    return null;
  }

  return {
    layer: "spec",
    mode: "detection",
    ruleId: "misleading_spec_followed",
    evidence: failed.slice(0, 4).map((requirement) => ({
      stepIndex: null,
      kind: "check" as const,
      detail: `${requirement.id} failed with no trace-level fault; the spec may be misleading`,
    })),
  };
}

/**
 * Deterministic rule engine. First matching rule wins. No model call, no
 * source inspection, and no guessed cell: evidence arrays are required.
 */
export function attributeRun(input: AttributionInput): AttributionResult {
  const passThreshold = input.passThreshold ?? DEFAULT_PASS_THRESHOLD;
  const passed = input.score.overall >= passThreshold && finishedRun(input.trace)?.exitReason === "completed";

  if (input.trace.length === 0) {
    return AttributionResultSchema.parse({
      status: "unavailable",
      attribution: null,
      reason: "trace_unavailable",
    });
  }

  if (passed) {
    return AttributionResultSchema.parse({
      status: "unattributed",
      attribution: null,
      reason: "run passed the threshold; no failure to attribute",
    });
  }

  const hasTraceFault = input.trace.some(
    (event) =>
      (event.type === "tool_call_finished" && event.status !== "ok") ||
      (event.type === "model_call_finished" && event.finishReason === "length"),
  );

  const rules: (() => Candidate | null)[] = [
    () => ruleRetriedGaveUp(input.trace),
    () => ruleToolErrorUnhandled(input.trace),
    () => ruleToolReturnedGarbage(input.trace),
    () => ruleHallucinatedApi(input.trace),
    () => ruleStepLimit(input.trace),
    () => ruleTokenLimit(input.trace),
    () => ruleIgnoredContradiction(input.trace),
    () => ruleAdapterErrorAfterModelCall(input.trace),
    () => ruleDroppedToolResult(input.trace),
    () => ruleZeroEdit(input.trace, passed),
    () => ruleFlaky(input.score, input.previousScores, hasTraceFault),
    () => ruleMisleadingSpec(input.score, passed),
  ];

  for (const rule of rules) {
    const candidate = rule();

    if (candidate !== null) {
      return AttributionResultSchema.parse({
        status: "attributed",
        attribution: {
          ...candidate,
          confidence: candidate.layer === "spec" ? "medium" : "medium",
          proof: null,
          candidates: [],
        },
        reason: null,
      });
    }
  }

  return AttributionResultSchema.parse({
    status: "unattributed",
    attribution: null,
    reason: "no rule matched the recorded trace; not attributable with the current ruleset",
  });
}
