import { z } from "zod";

export const TRACE_LIMITS = {
  maxEvents: 500,
  maxSerializedBytes: 262_144,
  maxSummaryChars: 2_000,
} as const;

export const ExitReasonSchema = z.enum([
  "completed",
  "failed",
  "timeout",
  "step_limit",
  "token_limit",
  "error",
]);
export type ExitReason = z.infer<typeof ExitReasonSchema>;

export const ChaosKindSchema = z.enum([
  "none",
  "tool_error",
  "latency",
  "context_pressure",
]);
export type ChaosKind = z.infer<typeof ChaosKindSchema>;

const StepIndexSchema = z.number().int().min(1).max(TRACE_LIMITS.maxEvents);
const SummarySchema = z.string().max(TRACE_LIMITS.maxSummaryChars);
const IsoTimeSchema = z.iso.datetime({ offset: true });

export const RunStartedEventSchema = z
  .object({
    type: z.literal("run_started"),
    at: IsoTimeSchema,
    runId: z.uuid(),
    adapter: z
      .object({ id: z.string().min(1).max(64), version: z.string().min(1).max(32) })
      .strict(),
    taskVersion: z.string().min(1).max(32),
    rulesetVersion: z.string().min(1).max(32),
    scoringConfigVersion: z.string().min(1).max(32),
    model: z
      .object({ provider: z.string().min(1).max(64), name: z.string().min(1).max(200) })
      .strict()
      .nullable(),
    startTime: IsoTimeSchema,
    runIndex: z.number().int().nonnegative(),
  })
  .strict();

export const ModelCallStartedEventSchema = z
  .object({
    type: z.literal("model_call_started"),
    at: IsoTimeSchema,
    stepIndex: StepIndexSchema,
    model: z.string().min(1).max(200),
    messagesHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const ModelCallFinishedEventSchema = z
  .object({
    type: z.literal("model_call_finished"),
    at: IsoTimeSchema,
    stepIndex: StepIndexSchema,
    durationMs: z.number().int().nonnegative(),
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative().max(1_000),
    finishReason: z.string().min(1).max(64),
  })
  .strict();

export const ToolCallStartedEventSchema = z
  .object({
    type: z.literal("tool_call_started"),
    at: IsoTimeSchema,
    stepIndex: StepIndexSchema,
    toolName: z.string().min(1).max(64),
    argsRedacted: SummarySchema,
    redacted: z.literal(true),
  })
  .strict();

export const ToolCallFinishedEventSchema = z
  .object({
    type: z.literal("tool_call_finished"),
    at: IsoTimeSchema,
    stepIndex: StepIndexSchema,
    toolName: z.string().min(1).max(64),
    durationMs: z.number().int().nonnegative(),
    status: z.enum(["ok", "error", "timeout"]),
    resultRedacted: SummarySchema,
    argsRedacted: SummarySchema.optional(),
    errorClass: z.string().min(1).max(64).nullable(),
    redacted: z.literal(true),
  })
  .strict();

export const StepCompletedEventSchema = z
  .object({
    type: z.literal("step_completed"),
    at: IsoTimeSchema,
    stepIndex: StepIndexSchema,
    durationMs: z.number().int().nonnegative(),
  })
  .strict();

export const ChaosInjectedEventSchema = z
  .object({
    type: z.literal("chaos_injected"),
    at: IsoTimeSchema,
    kind: ChaosKindSchema,
    payloadSummary: SummarySchema,
  })
  .strict();

export const RunTotalsSchema = z
  .object({
    steps: z.number().int().nonnegative(),
    toolCalls: z.number().int().nonnegative(),
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative().max(10_000),
    durationMs: z.number().int().nonnegative(),
  })
  .strict();
export type RunTotals = z.infer<typeof RunTotalsSchema>;

export const RunFinishedEventSchema = z
  .object({
    type: z.literal("run_finished"),
    at: IsoTimeSchema,
    endTime: IsoTimeSchema,
    exitReason: ExitReasonSchema,
    totals: RunTotalsSchema,
  })
  .strict();

export const TraceEventSchema = z.discriminatedUnion("type", [
  RunStartedEventSchema,
  ModelCallStartedEventSchema,
  ModelCallFinishedEventSchema,
  ToolCallStartedEventSchema,
  ToolCallFinishedEventSchema,
  StepCompletedEventSchema,
  ChaosInjectedEventSchema,
  RunFinishedEventSchema,
]);
export type TraceEvent = z.infer<typeof TraceEventSchema>;

export const TraceSchema = z.array(TraceEventSchema).max(TRACE_LIMITS.maxEvents);
export type RunTrace = z.infer<typeof TraceSchema>;

export const RunMetricsSchema = z
  .object({
    steps: z.number().int().nonnegative(),
    toolCalls: z.number().int().nonnegative(),
    toolErrorRate: z.number().min(0).max(1),
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative(),
    durationMs: z.number().int().nonnegative(),
    exitReason: ExitReasonSchema,
  })
  .strict();
export type RunMetrics = z.infer<typeof RunMetricsSchema>;

/**
 * Derives bounded metrics from a trace. The run_finished totals are
 * authoritative when present; event sums are the fallback for truncated runs.
 */
export function deriveRunMetrics(trace: readonly TraceEvent[]): RunMetrics {
  const finished = trace.find((event) => event.type === "run_finished");
  const toolCalls = trace.filter((event) => event.type === "tool_call_finished");
  const errors = toolCalls.filter(
    (event) => event.type === "tool_call_finished" && event.status !== "ok",
  );
  const modelCalls = trace.filter((event) => event.type === "model_call_finished");
  const steps = new Set(
    trace
      .filter(
        (event) =>
          event.type === "step_completed" ||
          event.type === "tool_call_finished" ||
          event.type === "model_call_finished",
      )
      .map((event) => event.stepIndex),
  ).size;

  if (finished !== undefined && finished.type === "run_finished") {
    return RunMetricsSchema.parse({
      steps: finished.totals.steps,
      toolCalls: finished.totals.toolCalls,
      toolErrorRate:
        finished.totals.toolCalls === 0 ? 0 : Math.min(1, errors.length / finished.totals.toolCalls),
      promptTokens: finished.totals.promptTokens,
      completionTokens: finished.totals.completionTokens,
      totalTokens: finished.totals.totalTokens,
      costUsd: finished.totals.costUsd,
      durationMs: finished.totals.durationMs,
      exitReason: finished.exitReason,
    });
  }

  const promptTokens = modelCalls.reduce(
    (sum, event) => sum + (event.type === "model_call_finished" ? event.promptTokens : 0),
    0,
  );
  const completionTokens = modelCalls.reduce(
    (sum, event) => sum + (event.type === "model_call_finished" ? event.completionTokens : 0),
    0,
  );
  const costUsd = modelCalls.reduce(
    (sum, event) => sum + (event.type === "model_call_finished" ? event.costUsd : 0),
    0,
  );

  return RunMetricsSchema.parse({
    steps,
    toolCalls: toolCalls.length,
    toolErrorRate: toolCalls.length === 0 ? 0 : Math.min(1, errors.length / toolCalls.length),
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    costUsd,
    durationMs: 0,
    exitReason: "error",
  });
}

export function serializeTrace(trace: readonly TraceEvent[]): string {
  return JSON.stringify(trace);
}

export function traceSizeBytes(trace: readonly TraceEvent[]): number {
  return Buffer.byteLength(serializeTrace(trace), "utf8");
}
