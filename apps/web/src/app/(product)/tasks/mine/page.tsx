import type { Metadata } from "next";
import Link from "next/link";

import { StatusChip } from "@/components/status-chip";
import { viewer } from "@/server/auth";
import { listUserTasks } from "@/server/community-tasks";

export const metadata: Metadata = { title: "Your tasks" };
export const dynamic = "force-dynamic";

const TONE: Record<string, "pass" | "fail" | "unverified" | "neutral"> = {
  pending: "unverified",
  validating: "unverified",
  validated: "pass",
  rejected: "fail",
  public: "pass",
};

export default async function MyTasksPage() {
  const current = await viewer();
  const tasks = await listUserTasks(current.id).catch(() => []);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">\ TASKS \</p>
          <h1 className="mt-2 font-display text-3xl tracking-[-0.02em]">Your submissions.</h1>
          <p className="mt-1 text-sm text-secondary">{current.username ?? `anonymous ${current.id.slice(0, 12)}…`}</p>
        </div>
        <Link href="/tasks/new" className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-app">Submit a task</Link>
      </header>

      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-subtle px-4 py-10 text-center text-sm text-muted">
          No submissions yet.
        </p>
      ) : (
        <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link href={`/tasks/${task.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-raised">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-primary">{task.title}</span>
                  <span className="mt-0.5 block font-mono text-[10px] text-muted">{task.repoUrl} @ {task.baseCommit.slice(0, 8)}</span>
                </span>
                <StatusChip tone={TONE[task.status] ?? "neutral"}>{task.status}</StatusChip>
                <span className="font-mono text-[10px] text-muted">{task.visibility}</span>
                <span className="text-muted">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
