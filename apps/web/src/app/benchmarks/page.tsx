import type { Metadata } from "next";

import { TaskCard } from "@/components/task-card";
import { taskSummaries } from "@/server/tasks";

export const metadata: Metadata = {
  title: "Benchmarks",
};

export const dynamic = "force-dynamic";

export default function BenchmarksPage() {
  const tasks = taskSummaries();

  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Benchmarks</h1>
        <p className="mt-2 text-sm leading-6 text-secondary">
          Each task pins a specification, a ruleset, and a scoring configuration. The version
          triple is recorded on every result, so a score can always be reproduced against the
          exact rules it was measured with.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>

      <section className="rounded-lg border border-border-subtle bg-panel p-4">
        <h2 className="text-sm font-semibold text-primary">Task contract</h2>
        <ul className="mt-2 space-y-1 text-xs leading-5 text-secondary">
          <li>
            <span className="font-mono text-primary">PROJECT_SPEC.md</span> is parsed
            deterministically; declared checks are the only source of verdicts.
          </li>
          <li>
            Starting files are the only inputs. The produced repository is captured as bounded
            text and scored statically; produced code is never executed by the scoring engine.
          </li>
          <li>
            Missing evidence is <span className="font-mono">UNVERIFIED</span>, earns zero, and is
            reported separately from <span className="font-mono">FAIL</span>.
          </li>
        </ul>
      </section>
    </div>
  );
}
