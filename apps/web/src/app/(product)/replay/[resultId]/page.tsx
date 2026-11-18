import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusChip } from "@/components/status-chip";
import { TraceView } from "@/components/trace-view";
import { webResult } from "@/server/results";

export const dynamic = "force-dynamic";

export default async function ReplayPage({ params }: { params: Promise<{ resultId: string }> }) {
  const { resultId } = await params;
  const read = await webResult(resultId);

  if (read.result === null) {
    notFound();
  }

  const result = read.result;
  const attribution = result.attribution;
  const proof = attribution?.proof;

  if (attribution == null || proof == null) {
    return (
      <div className="space-y-4">
        <nav aria-label="Breadcrumb" className="text-xs text-muted">
          <Link href={`/results/${resultId}`} className="hover:text-secondary">Result</Link> / Replay
        </nav>
        <h1 className="font-display text-3xl tracking-[-0.02em]">No replay proof</h1>
        <p className="text-sm text-secondary">
          {result.attributionReason ?? "No sufficient intervention is stored for this result."}
        </p>
      </div>
    );
  }

  const divergence = proof.intervention.stepIndex;

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href={`/results/${resultId}`} className="hover:text-secondary">Result</Link> / Replay
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            counterfactual proof · {result.adapter.label}
          </p>
          <h1 className="mt-1 font-display text-3xl tracking-[-0.02em]">
            {attribution.layer} × {attribution.mode}
          </h1>
          <p className="mt-1 text-sm text-secondary">{proof.intervention.summary}</p>
        </div>
        <StatusChip tone={proof.counterfactual.passed ? "pass" : "fail"}>
          {proof.counterfactual.passed ? "Pass" : "Fail"}
        </StatusChip>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border-subtle bg-panel p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">baseline</p>
          <p className="mt-2 font-mono text-2xl text-primary">{proof.baseline.overall.toFixed(1)}</p>
          <p className="mt-1 text-xs text-secondary">{proof.baseline.exitReason}</p>
        </div>
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent">counterfactual</p>
          <p className="mt-2 font-mono text-2xl text-primary">{proof.counterfactual.overall.toFixed(1)}</p>
          <p className="mt-1 text-xs text-secondary">{proof.counterfactual.replayedSteps} replayed steps</p>
        </div>
        <div className="rounded-xl border border-border-subtle bg-panel p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">intervention</p>
          <p className="mt-2 font-mono text-sm text-primary">{proof.intervention.kind}</p>
          <p className="mt-1 text-xs text-secondary">at step {divergence} · threshold {proof.counterfactual.passThreshold}</p>
        </div>
      </div>

      <section>
        <h2 className="text-sm font-medium text-primary">Baseline trace</h2>
        <p className="mt-1 text-xs text-secondary">
          Steps before {divergence} are byte-identical in the replay. The highlighted step is where the intervention applies.
        </p>
        <div className="mt-3">
          {result.trace ? (
            <TraceView trace={result.trace} highlightStep={divergence} />
          ) : (
            <p className="rounded-xl border border-dashed border-border-subtle px-4 py-8 text-center text-sm text-muted">
              The stored trace is unavailable.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border-subtle bg-panel p-4">
        <h2 className="text-sm font-medium text-primary">Deterministic scoring note</h2>
        <p className="mt-2 text-xs leading-6 text-secondary">
          Replay writes the recorded text actions into a fresh in-memory file map, applies one
          intervention at step {divergence}, and scores with the existing engine. It makes no model
          call and executes no produced code.
        </p>
        {attribution.candidates.length > 1 ? (
          <ul className="mt-3 space-y-1 font-mono text-[11px] text-muted">
            {attribution.candidates.map((candidate, index) => (
              <li key={index}>
                candidate {index + 1}: {candidate.intervention.kind} @ {candidate.intervention.stepIndex} →{" "}
                {candidate.counterfactual.overall.toFixed(1)} {candidate.counterfactual.passed ? "PASS" : "FAIL"}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
