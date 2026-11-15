import Link from "next/link";

import { LeaderboardTable } from "@/components/leaderboard-table";
import { StatusChip } from "@/components/status-chip";
import { TaskCard } from "@/components/task-card";
import { webLeaderboard } from "@/server/results";
import { taskSummaries } from "@/server/tasks";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [leaderboard, tasks] = await Promise.all([
    webLeaderboard({ limit: 5 }),
    Promise.resolve(taskSummaries()),
  ]);
  const sample = leaderboard.store === "seed";

  return (
    <div className="space-y-14">
      <section className="max-w-3xl">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent">
            Benchmark the agent, not just the model
          </p>
        </div>

        <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
          A scorecard for AI software-engineering agents.
        </h1>

        <p className="mt-5 max-w-2xl text-sm leading-6 text-secondary">
          Orivoxx runs an agent against a versioned{" "}
          <code className="font-mono text-xs text-primary">PROJECT_SPEC.md</code> inside a
          Docker sandbox, captures the produced repository, and scores it deterministically on
          spec conformance, security patterns, and structural maintainability. Every point
          traces to a named rule and evidence. No model is in the score path.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/submit"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-app transition-opacity hover:opacity-90"
          >
            Run the fake baseline
          </Link>
          <Link
            href="/leaderboard"
            className="rounded-md border border-border-strong bg-raised px-4 py-2 text-sm text-primary transition-colors hover:border-accent"
          >
            Explore results
          </Link>
        </div>
      </section>

      <section aria-label="How the score is built" className="grid gap-3 sm:grid-cols-3">
        {[
          ["3 benches", "Spec 60%, security 25%, maintainability 15%. Critical failures cap the score."],
          ["Deterministic", "Static parsing and declared checks. Re-running the same repository gives the same score."],
          ["Traceable", "Requirement ids, rule types, paths, versions, and a repository fingerprint on every row."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-lg border border-border-subtle bg-panel p-4">
            <p className="text-sm font-semibold text-primary">{title}</p>
            <p className="mt-1.5 text-xs leading-5 text-secondary">{body}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="leaderboard-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="leaderboard-heading" className="text-lg font-semibold text-primary">
              Latest leaderboard
            </h2>
            <p className="mt-0.5 text-xs text-secondary">
              Ranked by overall score, then earliest result. Fake rows are labelled.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {sample ? <StatusChip tone="degraded">Sample data</StatusChip> : null}
            {leaderboard.baselinesOnly ? <StatusChip tone="sample">Baselines only</StatusChip> : null}
            <Link href="/leaderboard" className="text-xs text-accent-secondary hover:underline">
              All results
            </Link>
          </div>
        </div>

        {leaderboard.entries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-subtle px-4 py-8 text-center text-sm text-muted">
            No results yet. Run the fake baseline to create the first one.
          </p>
        ) : (
          <LeaderboardTable rows={leaderboard.entries} caption="Latest benchmark results" />
        )}
      </section>

      <section aria-labelledby="tasks-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="tasks-heading" className="text-lg font-semibold text-primary">
              Benchmarks
            </h2>
            <p className="mt-0.5 text-xs text-secondary">
              Versioned tasks. A task version pins the spec, ruleset, and scoring configuration.
            </p>
          </div>
          <Link href="/benchmarks" className="text-xs text-accent-secondary hover:underline">
            Catalogue
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </section>
    </div>
  );
}
