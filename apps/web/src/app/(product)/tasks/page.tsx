import type { Metadata } from "next";
import Link from "next/link";

import { CURATED_REAL_TASKS } from "@orivoxx/benchmarks";

import { StatusChip } from "@/components/status-chip";
import { listPublicCommunityTasks } from "@/server/community-tasks";

export const metadata: Metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const community = await listPublicCommunityTasks().catch(() => []);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">\ REAL TASKS \</p>
          <h1 className="mt-2 font-display text-4xl tracking-[-0.03em]">Repository issues, not synthetic specs.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-secondary">
            A base commit, an issue, and one test command. The primary success condition is exit 0;
            security and maintainability remain deterministic quality flags.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/tasks/mine" className="rounded-full border border-border-subtle px-4 py-2 text-xs text-secondary">Your tasks</Link>
          <Link href="/tasks/new" className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-app">Submit a task</Link>
        </div>
      </header>

      <section>
        <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Curated</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {CURATED_REAL_TASKS.map((task) => (
            <Link key={task.id} href={`/tasks/${task.id}`} className="rounded-xl border border-border-subtle bg-panel p-4 transition-colors hover:border-border-strong">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-muted">{task.language} · {task.difficulty}</span>
                <StatusChip tone="pass">public</StatusChip>
              </div>
              <p className="mt-2 text-sm text-primary">{task.title}</p>
              <p className="mt-1 font-mono text-[10px] text-muted">{task.repoUrl} @ {task.baseCommit.slice(0, 8)}</p>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-secondary">{task.summary}</p>
            </Link>
          ))}
        </div>
      </section>

      {community.length > 0 ? (
        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Community</h2>
          <ul className="mt-3 divide-y divide-border-subtle rounded-xl border border-border-subtle">
            {community.map((task) => (
              <li key={task.id}>
                <Link href={`/tasks/${task.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised">
                  <span className="flex-1 text-sm text-primary">{task.title}</span>
                  <StatusChip tone={task.status === "public" ? "pass" : task.status === "rejected" ? "fail" : "unverified"}>{task.status}</StatusChip>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
