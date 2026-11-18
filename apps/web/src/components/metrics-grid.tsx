import type { RunMetrics } from "@orivoxx/core";

export function MetricsGrid({ metrics }: { metrics: RunMetrics }) {
  const cells = [
    ["Steps", String(metrics.steps), "model + tool steps"],
    ["Tool calls", String(metrics.toolCalls), `${Math.round(metrics.toolErrorRate * 100)}% error rate`],
    ["Prompt tokens", metrics.promptTokens.toLocaleString("en-US"), "provider usage"],
    ["Completion", metrics.completionTokens.toLocaleString("en-US"), "provider usage"],
    ["Cost", `$${metrics.costUsd.toFixed(4)}`, "reported by provider"],
    ["Duration", `${(metrics.durationMs / 1000).toFixed(1)}s`, "wall clock"],
  ] as const;

  return (
    <section aria-label="Run metrics" className="rounded-xl border border-border-subtle bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-primary">Six metrics</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
          exit: {metrics.exitReason}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cells.map(([label, value, detail]) => (
          <div key={label} className="rounded-lg border border-border-subtle bg-app px-3 py-2.5">
            <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">{label}</dt>
            <dd className="mt-1 font-mono text-base text-primary">{value}</dd>
            <dd className="mt-0.5 text-[10px] text-muted">{detail}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[10px] text-muted">
        Trace-derived. Tool errors are counted from finished tool calls; token and cost values come
        from the provider usage recorded by the proxy.
      </p>
    </section>
  );
}
