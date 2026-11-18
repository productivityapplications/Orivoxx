import type { Metadata } from "next";
import Link from "next/link";

import type { BenchmarkResult } from "@orivoxx/results";

import { ComparePanel, type CompareRow, type CompareSide } from "@/components/compare-panel";
import { EmptyState } from "@/components/empty-state";
import { StatusChip } from "@/components/status-chip";
import { webLeaderboard, webResult } from "@/server/results";
import { taskDetail, taskSummaries } from "@/server/tasks";

export const metadata: Metadata = {
  title: "Compare",
};

export const dynamic = "force-dynamic";

function side(result: BenchmarkResult): CompareSide {
  return {
    resultId: result.resultId,
    adapter: { label: result.adapter.label, kind: result.adapter.kind },
    model: result.model === null ? null : { name: result.model.name },
    overall: result.overall,
    benches: result.benches,
    tally: result.tally,
    capsApplied: result.capsApplied,
  };
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string; a?: string; b?: string }>;
}) {
  const query = await searchParams;
  const tasks = taskSummaries();
  const taskId = tasks.some((entry) => entry.id === query.task) ? (query.task as string) : "taskboard";
  const task = taskDetail(taskId);
  const board = await webLeaderboard({ taskId, limit: 100 });

  // Prefer a pair with the same model and different harnesses: that is the
  // comparison the benchmark exists to make. Fall back to the top two rows.
  function defaultPair(): [string | undefined, string | undefined] {
    for (let left = 0; left < board.entries.length; left += 1) {
      for (let right = left + 1; right < board.entries.length; right += 1) {
        const a = board.entries[left];
        const b = board.entries[right];

        if (
          a !== undefined &&
          b !== undefined &&
          a.adapter.id !== b.adapter.id &&
          a.model?.name !== undefined &&
          a.model.name === b.model?.name
        ) {
          return [a.resultId, b.resultId];
        }
      }
    }

    return [board.entries[0]?.resultId, board.entries[1]?.resultId];
  }

  const [defaultA, defaultB] = defaultPair();
  const pickA = query.a ?? defaultA;
  const pickB = query.b ?? defaultB;

  const [aRead, bRead] = await Promise.all([
    pickA === undefined ? Promise.resolve(null) : webResult(pickA),
    pickB === undefined ? Promise.resolve(null) : webResult(pickB),
  ]);
  const a = aRead?.result ?? null;
  const b = bRead?.result ?? null;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compare</h1>
          <p className="mt-1 text-sm text-secondary">
            Two results on one task. The same model slug means only the harness varies.
          </p>
        </div>
        <nav aria-label="Task filter" className="flex flex-wrap gap-1.5">
          {tasks.map((entry) => (
            <Link
              key={entry.id}
              href={`/compare?task=${entry.id}`}
              aria-current={entry.id === taskId ? "page" : undefined}
              className={`rounded border px-2.5 py-1 text-xs ${
                entry.id === taskId
                  ? "border-accent bg-raised text-primary"
                  : "border-border-subtle text-secondary hover:border-border-strong"
              }`}
            >
              {entry.id}
            </Link>
          ))}
        </nav>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-panel px-4 py-3">
        <StatusChip tone="neutral">{taskId}</StatusChip>
        <span className="text-xs text-secondary">
          {task === null
            ? "Unknown task."
            : `task ${task.version} · ruleset ${task.rulesetVersion} · scoring ${task.scoringConfigVersion}`}
        </span>
        <span className="text-xs text-muted">{board.entries.length} results on this task</span>
      </div>

      {a === null || b === null ? (
        <EmptyState
          title="Two results are needed"
          description="Record at least two results for this task. The fake baseline works offline and creates real rows."
          action={{ href: "/submit", label: "Run the fake baseline" }}
        />
      ) : (
        <>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border-subtle bg-panel p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">A attribution</p>
            <p className="mt-2 text-sm text-primary">
              {a.attribution ? `${a.attribution.layer} × ${a.attribution.mode}` : a.attributionReason ?? "none"}
            </p>
            <p className="mt-1 text-xs text-secondary">
              {a.attribution?.proof ? `proof ${a.attribution.proof.baseline.overall.toFixed(1)} → ${a.attribution.proof.counterfactual.overall.toFixed(1)}` : "no proof"}
            </p>
          </div>
          <div className="rounded-xl border border-border-subtle bg-panel p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">B attribution</p>
            <p className="mt-2 text-sm text-primary">
              {b.attribution ? `${b.attribution.layer} × ${b.attribution.mode}` : b.attributionReason ?? "none"}
            </p>
            <p className="mt-1 text-xs text-secondary">
              {b.attribution?.proof ? `proof ${b.attribution.proof.baseline.overall.toFixed(1)} → ${b.attribution.proof.counterfactual.overall.toFixed(1)}` : "no proof"}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border-subtle">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <caption className="sr-only">Run metric deltas, B minus A</caption>
            <thead>
              <tr className="border-b border-border-subtle bg-panel font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                <th scope="col" className="px-3 py-2 font-medium">Metric</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">A</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">B</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">B − A</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle bg-panel/50">
              {([
                ["Steps", "steps"],
                ["Tool calls", "toolCalls"],
                ["Tool error rate", "toolErrorRate"],
                ["Total tokens", "totalTokens"],
                ["Cost USD", "costUsd"],
                ["Duration ms", "durationMs"],
              ] as const).map(([label, key]) => {
                const av = a.metrics?.[key] ?? 0;
                const bv = b.metrics?.[key] ?? 0;
                return (
                  <tr key={key}>
                    <th scope="row" className="px-3 py-2 font-medium text-secondary">{label}</th>
                    <td className="px-3 py-2 text-right font-mono text-xs text-secondary">{av.toLocaleString("en-US")}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-secondary">{bv.toLocaleString("en-US")}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-primary">{(bv - av).toLocaleString("en-US")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <ComparePanel
          a={side(a)}
          b={side(b)}
          rows={
            (task?.requirements ?? []).map<CompareRow>((requirement) => {
              return {
                id: requirement.id,
                title: requirement.title,
                bench: requirement.bench,
                a:
                  a.score.requirements.find((entry) => entry.id === requirement.id)?.status ??
                  "UNVERIFIED",
                b:
                  b.score.requirements.find((entry) => entry.id === requirement.id)?.status ??
                  "UNVERIFIED",
              };
            })
          }
        />
        </>
      )}
    </div>
  );
}
