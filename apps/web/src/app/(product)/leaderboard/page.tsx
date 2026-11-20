import type { Metadata } from "next";
import Link from "next/link";
import { groupReliability } from "@orivoxx/results";

import { EmptyState } from "@/components/empty-state";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { StatusChip } from "@/components/status-chip";
import { CURATED_REAL_TASKS } from "@orivoxx/benchmarks";

import { viewer } from "@/server/auth";
import { listUserTasks } from "@/server/community-tasks";
import { webLeaderboard } from "@/server/results";
import { taskSummaries } from "@/server/tasks";

export const metadata: Metadata = {
  title: "Leaderboard",
};

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string; kind?: string }>;
}) {
  const { task, kind } = await searchParams;
  const tasks = taskSummaries();
  const activeTask = tasks.some((entry) => entry.id === task) ? task : undefined;
  const activeKind =
    kind === "baselines" || kind === "all" ? kind : ("agents" as const);
  const leaderboard = await webLeaderboard({
    taskId: activeTask,
    limit: 100,
    kind: activeKind,
  });
  const current = await viewer();
  const myTasks = await listUserTasks(current.id).catch(() => []);
  const profiles = new Map(
    groupReliability(leaderboard.entries).map((group) => [
      `${group.adapterId}:${group.taskId}`,
      group.profile,
    ]),
  );
  const sample = leaderboard.store === "seed";

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
          <p className="mt-1 text-sm text-secondary">
            {leaderboard.entries.length} result{leaderboard.entries.length === 1 ? "" : "s"} ·
            score desc, then earliest result
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sample ? (
            <StatusChip tone="degraded" title="Bundled seed rows are answering">
              Sample data
            </StatusChip>
          ) : null}
          {leaderboard.baselinesOnly ? (
        <p className="rounded border border-accent/40 bg-accent/5 px-3 py-2 text-xs text-accent">
          No harness result exists for this scope yet, so recorded baselines are shown. They are
          labelled Sample and do not represent a model.
        </p>
      ) : null}

      {leaderboard.degraded ? (
            <StatusChip tone="degraded" title={leaderboard.problem}>
              Store degraded
            </StatusChip>
          ) : null}
          <Link
            href="/submit"
            className="rounded-md border border-border-strong bg-raised px-3 py-1.5 text-xs text-primary hover:border-accent"
          >
            Run fake baseline
          </Link>
        </div>
      </header>

      <nav aria-label="Result kind" className="flex flex-wrap gap-1.5">
        {(
          [
            ["agents", "Agents"],
            ["all", "All"],
            ["baselines", "Baselines"],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={`/leaderboard?${new URLSearchParams({
              ...(activeTask === undefined ? {} : { task: activeTask }),
              kind: value,
            }).toString()}`}
            aria-current={activeKind === value ? "page" : undefined}
            className={`rounded border px-2.5 py-1 text-xs ${
              activeKind === value
                ? "border-accent bg-raised text-primary"
                : "border-border-subtle text-secondary hover:border-border-strong"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <nav aria-label="Task filter" className="flex flex-wrap gap-1.5">
        <Link
          href="/leaderboard"
          aria-current={activeTask === undefined ? "page" : undefined}
          className={`rounded border px-2.5 py-1 text-xs ${
            activeTask === undefined
              ? "border-accent bg-raised text-primary"
              : "border-border-subtle text-secondary hover:border-border-strong"
          }`}
        >
          All tasks
        </Link>
        {CURATED_REAL_TASKS.slice(0, 6).map((entry) => (
          <Link
            key={entry.id}
            href={`/leaderboard?task=${entry.id}`}
            aria-current={activeTask === entry.id ? "page" : undefined}
            className={`rounded border px-2.5 py-1 text-xs ${
              activeTask === entry.id
                ? "border-accent bg-raised text-primary"
                : "border-border-subtle text-secondary hover:border-border-strong"
            }`}
          >
            {entry.id}
          </Link>
        ))}
        {tasks.map((entry) => (
          <Link
            key={entry.id}
            href={`/leaderboard?task=${entry.id}`}
            aria-current={activeTask === entry.id ? "page" : undefined}
            className={`rounded border px-2.5 py-1 text-xs ${
              activeTask === entry.id
                ? "border-accent bg-raised text-primary"
                : "border-border-subtle text-secondary hover:border-border-strong"
            }`}
          >
            {entry.id}
          </Link>
        ))}
      </nav>

      {leaderboard.baselinesOnly ? (
        <p className="rounded border border-accent/40 bg-accent/5 px-3 py-2 text-xs text-accent">
          No harness result exists for this scope yet, so recorded baselines are shown. They are
          labelled Sample and do not represent a model.
        </p>
      ) : null}

      {leaderboard.degraded ? (
        <p className="rounded border border-unverified/40 bg-unverified/5 px-3 py-2 text-xs text-unverified">
          The shared store did not answer ({leaderboard.problem ?? "store_unavailable"}). These
          rows come from the bundled seed and are read-only.
        </p>
      ) : null}

      {leaderboard.entries.length === 0 ? (
        <EmptyState
          title="No results yet"
          description="Run the fake baseline to create the first scorecard. Real adapter runs are organizer-executed and appear here when published."
          action={{ href: "/submit", label: "Run the fake baseline" }}
        />
      ) : (
        <LeaderboardTable
          rows={leaderboard.entries}
          caption="Benchmark leaderboard"
          reliability={profiles}
        />
      )}

      {myTasks.length > 0 ? (
        <section className="rounded-xl border border-border-subtle bg-panel p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-primary">Your tasks</h2>
            <Link href="/tasks/mine" className="text-xs text-accent-secondary hover:underline">All submissions →</Link>
          </div>
          <ul className="mt-3 space-y-2">
            {myTasks.slice(0, 5).map((task) => (
              <li key={task.id} className="flex flex-wrap items-center gap-2 text-xs">
                <Link href={`/tasks/${task.id}`} className="text-secondary hover:text-primary">{task.title}</Link>
                <span className="font-mono text-[10px] text-muted">{task.visibility}</span>
                <span className="ml-auto font-mono text-[10px] text-muted">{task.status}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs leading-5 text-muted">
        A leaderboard-valid row records task, ruleset, scoring-config, and adapter versions plus a
        repository fingerprint. Rows missing any of them are rejected by the store schema.
      </p>
    </div>
  );
}
