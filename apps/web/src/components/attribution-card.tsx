import Link from "next/link";

import type { Attribution } from "@orivoxx/core";

import { StatusChip } from "./status-chip";

export function AttributionCard({
  attribution,
  reason,
  resultId,
}: {
  attribution: Attribution | null | undefined;
  reason?: string | null;
  resultId: string;
}) {
  if (attribution === null || attribution === undefined) {
    return (
      <section aria-label="Failure attribution" className="rounded-xl border border-border-subtle bg-panel p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone="unverified">Unattributed</StatusChip>
          <h2 className="text-sm font-medium text-primary">Failure attribution</h2>
        </div>
        <p className="mt-3 text-xs leading-6 text-secondary">
          {reason ?? "No deterministic rule matched the recorded trace. No cell is guessed."}
        </p>
        <Link href={`/results/${resultId}/trace`} className="mt-3 inline-block text-xs text-accent-secondary hover:underline">
          Inspect the trace →
        </Link>
      </section>
    );
  }

  const proof = attribution.proof;

  return (
    <section aria-label="Failure attribution" className="rounded-xl border border-fail/30 bg-fail/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone="fail">Attributed</StatusChip>
          <h2 className="text-sm font-medium text-primary">
            {attribution.layer} × {attribution.mode}
          </h2>
          <StatusChip tone={attribution.confidence === "high" ? "pass" : "unverified"}>
            {attribution.confidence} confidence
          </StatusChip>
        </div>
        <span className="font-mono text-[10px] text-muted">rule: {attribution.ruleId}</span>
      </div>

      <ul className="mt-3 space-y-1.5">
        {attribution.evidence.map((evidence) => (
          <li key={`${evidence.stepIndex}-${evidence.detail}`} className="font-mono text-[11px] leading-5 text-secondary">
            <span className="text-muted">step {evidence.stepIndex ?? "—"}</span> · {evidence.detail}
          </li>
        ))}
      </ul>

      {proof !== null ? (
        <div className="mt-4 rounded-lg border border-accent/25 bg-accent/5 p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent">proof</p>
          <p className="mt-1 text-xs text-primary">
            Replay with {proof.intervention.kind.replaceAll("_", " ")} at step {proof.intervention.stepIndex} →{" "}
            {proof.counterfactual.passed ? "PASS" : "FAIL"} (
            {proof.baseline.overall.toFixed(1)} → {proof.counterfactual.overall.toFixed(1)})
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted">
            intervention at {proof.intervention.stepIndex} · replayed {proof.counterfactual.replayedSteps} steps · threshold {proof.counterfactual.passThreshold}
          </p>
          <Link href={`/replay/${resultId}`} className="mt-2 inline-block text-xs text-accent-secondary hover:underline">
            View proof →
          </Link>
        </div>
      ) : (
        <p className="mt-3 text-xs text-secondary">
          No sufficient intervention was found. This cell is rule-matched but not proven.
        </p>
      )}
    </section>
  );
}
