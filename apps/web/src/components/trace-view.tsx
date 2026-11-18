import type { TraceEvent } from "@orivoxx/core";

const LABELS: Record<TraceEvent["type"], string> = {
  run_started: "Run started",
  model_call_started: "Model call started",
  model_call_finished: "Model call finished",
  tool_call_started: "Tool call started",
  tool_call_finished: "Tool call finished",
  step_completed: "Step completed",
  chaos_injected: "Chaos injected",
  run_finished: "Run finished",
};

function stepOf(event: TraceEvent): number | null {
  return "stepIndex" in event ? event.stepIndex : null;
}

function detail(event: TraceEvent): string {
  switch (event.type) {
    case "run_started":
      return `${event.adapter.id} ${event.adapter.version} · run ${event.runIndex}`;
    case "model_call_started":
      return `${event.model} · messages ${event.messagesHash.slice(0, 8)}…`;
    case "model_call_finished":
      return `${event.promptTokens} in / ${event.completionTokens} out · $${event.costUsd.toFixed(5)} · ${event.finishReason}`;
    case "tool_call_started":
      return `${event.toolName} · ${event.argsRedacted}`;
    case "tool_call_finished":
      return `${event.toolName} · ${event.status} · ${event.resultRedacted}`;
    case "step_completed":
      return `${event.durationMs} ms`;
    case "chaos_injected":
      return `${event.kind} · ${event.payloadSummary}`;
    case "run_finished":
      return `${event.exitReason} · ${event.totals.steps} steps · ${event.totals.toolCalls} tools · ${event.totals.totalTokens} tokens · $${event.totals.costUsd.toFixed(4)}`;
  }
}

export function TraceView({
  trace,
  limit = 500,
  highlightStep,
}: {
  trace: TraceEvent[];
  limit?: number;
  highlightStep?: number;
}) {
  return (
    <ol className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle">
      {trace.slice(0, limit).map((event, index) => {
        const step = stepOf(event);
        const error = event.type === "tool_call_finished" && event.status !== "ok";
        const active = highlightStep !== undefined && step === highlightStep;

        return (
          <li
            key={`${event.type}-${index}`}
            className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-xs ${
              active ? "bg-fail/10" : error ? "bg-fail/5" : "bg-panel/40"
            }`}
          >
            <span className="w-9 shrink-0 font-mono text-[10px] text-muted">{step ?? "—"}</span>
            <span className="w-40 shrink-0 text-secondary">{LABELS[event.type]}</span>
            <span className={`min-w-0 flex-1 font-mono text-[10px] ${error ? "text-fail" : "text-muted"}`}>
              {detail(event)}
            </span>
            {"redacted" in event ? (
              <span className="rounded border border-border-subtle px-1 py-0.5 font-mono text-[9px] uppercase text-muted">
                redacted
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
