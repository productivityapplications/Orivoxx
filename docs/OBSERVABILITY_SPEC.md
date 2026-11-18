# Orivoxx — Observability Spec

**Version:** 1.0 · **Status:** shipped contract for trace capture, metrics, and reliability.

## 1. Why a trace

The score says *what* the agent produced. The trace says *how* it got there. Attribution needs ordered evidence: which model call, which tool call, which failure, and which step a counterfactual can intervene on.

The trace is captured by the harness around an untrusted agent. It is bounded, redacted, and stored with the result.

## 2. Event model

Zod schemas live in `packages/core/src/contracts/observability.ts`.

All events carry `type` and `at` (ISO timestamp). `stepIndex` is 1-based and monotonic within a run.

```ts
RunStarted {
  type: "run_started";
  runId: string;
  adapter: { id: string; version: string };
  taskVersion: string;
  rulesetVersion: string;
  scoringConfigVersion: string;
  model: { provider: string; name: string } | null;
  startTime: string;
  runIndex: number;
}

ModelCallStarted {
  type: "model_call_started";
  stepIndex: number;
  model: string;
  messagesHash: string;       // sha256, never the messages
}

ModelCallFinished {
  type: "model_call_finished";
  stepIndex: number;
  durationMs: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  finishReason: string;
}

ToolCallStarted {
  type: "tool_call_started";
  stepIndex: number;
  toolName: string;
  argsRedacted: string;       // e.g. "write_file path=src/a.ts bytes=1024"
  redacted: true;
}

ToolCallFinished {
  type: "tool_call_finished";
  stepIndex: number;
  toolName: string;
  durationMs: number;
  status: "ok" | "error" | "timeout";
  resultRedacted: string;     // e.g. "ok bytes=1024" | "EACCES"
  errorClass: string | null;
  redacted: true;
}

StepCompleted {
  type: "step_completed";
  stepIndex: number;
  durationMs: number;
}

ChaosInjected {
  type: "chaos_injected";
  kind: "none" | "tool_error" | "latency" | "context_pressure";
  payloadSummary: string;     // no source, no secrets
}

RunFinished {
  type: "run_finished";
  endTime: string;
  exitReason: "completed" | "failed" | "timeout" | "step_limit" | "token_limit" | "error";
  totals: {
    steps: number;
    toolCalls: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
    durationMs: number;
  };
}
```

`TraceEventSchema` is a discriminated union. `TraceSchema` is an ordered array, max 500 events, max 256 KiB serialized.

## 3. Redaction rules

- Tool arguments and results are **summaries only**: tool name, path, byte count, status/error class. Never raw file contents, prompts, model output, env values, or secrets.
- `messagesHash` is a SHA-256 of the request messages; the messages are never stored.
- Model call events contain token counts and cost, not text.
- Every redacted field carries `redacted: true`; the UI renders a “redacted” chip.
- Trace events are validated on capture. An invalid event is dropped with a warning; it never reaches the result store.

## 4. Capture path

```text
python agent ──writes──▶ /workspace/.orivoxx/trace.jsonl  (tool + step events)
proxy sidecar ─writes──▶ host trace dir/proxy.jsonl        (model call events)
                                  │
harness after exit ───────────────┴──▶ parse, merge by step, cap, validate
                                  │
                                  ├──▶ result.trace
                                  └──▶ replay action log (ephemeral, never stored)
```

- The agent never sees the proxy trace directory.
- The workspace trace file is deleted before capture and is excluded from the produced repository.
- The action log (full write contents for replay) is held in harness memory during the organizer run and is **not persisted**; only the proof summary is stored.
- A run without a valid trace is still scored; attribution is `null` with reason `trace_unavailable`.

## 5. Derived per-run metrics

```ts
RunMetrics = {
  steps: number;
  toolCalls: number;
  toolErrorRate: number;     // 0..1
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  durationMs: number;
  exitReason: ExitReason;
}
```

Metrics are computed from the trace, not self-reported by the agent.

## 6. Cross-run reliability

For an `(adapter, task)` group:

- `artifactScoreMean`, `artifactScoreStd` over all runs.
- `pass@k`: fraction of runs with `overall >= passThreshold` **and** `exitReason === "completed"`.
- `layerDistribution`: counts over `{spec, model, harness, tool, environment}` for attributed failures.
- `chaosSensitivity`: pass@k per chaos condition.
- `trend`: signed change in mean score between the first and last half of the run window.

`passThreshold` defaults to `70` (task-specific override allowed; stored on the task view).

## 7. Bounds and retention

| Bound | Value |
|---|---|
| Events per run | 500 |
| Serialized trace | 256 KiB |
| Event summary field | 2,000 chars |
| Trace retention | same 90 days as the result |
| Action log | memory only, deleted after attribution |

## 8. Failure and partial states

| State | Behavior |
|---|---|
| Agent exits without a trace | Score stored; `attribution: null`, reason `trace_unavailable` |
| Proxy trace missing | Model metrics from the agent’s events are used when valid; otherwise token/cost are `0` and `metrics.confidence: "partial"` |
| Invalid event | Dropped with `trace_warning`; the remaining trace is stored |
| Trace over budget | Last events dropped, `traceTruncated: true`; attribution runs on the retained prefix |

## 9. Test families

- Schema validation for every event type; unknown fields rejected.
- Redaction: no content/prompt/secret appears in a serialized trace.
- Ordering: step indices monotonic; merge of proxy + agent events deterministic.
- Bounds: 500-event and 256 KiB truncation.
- Metrics: token/cost sums, tool error rate, exit reason.
- Capture: workspace trace excluded from the produced repository.
