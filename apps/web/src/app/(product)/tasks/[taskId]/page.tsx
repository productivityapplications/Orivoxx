import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CURATED_REAL_TASKS } from "@orivoxx/benchmarks";

import { CuratorActions } from "@/components/curator-actions";
import { StatusChip } from "@/components/status-chip";
import { TaskProgress } from "@/components/task-progress";
import { viewer } from "@/server/auth";
import { canView, getCommunityTask, isCurator, validationEvents } from "@/server/community-tasks";

export const metadata: Metadata = { title: "Task" };
export const dynamic = "force-dynamic";

const TONE: Record<string, "pass" | "fail" | "unverified" | "neutral"> = {
  pending: "unverified",
  validating: "unverified",
  validated: "pass",
  rejected: "fail",
  public: "pass",
};

export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const current = await viewer();
  let task = await getCommunityTask(taskId).catch(() => null);
  if (task === null) task = CURATED_REAL_TASKS.find((entry) => entry.id === taskId) ?? null;
  if (task === null) notFound();

  if (!canView(task, current.id)) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">403 · private task</p>
        <h1 className="mt-3 font-display text-3xl">This task is private.</h1>
        <p className="mt-2 text-sm text-secondary">It is visible only to the submitter.</p>
      </div>
    );
  }

  const events = await validationEvents(taskId).catch(() => []);
  const curator = current.username !== null && isCurator(current.username);

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/tasks/mine" className="hover:text-secondary">Tasks</Link> / <span className="text-secondary">{task.id}</span>
      </nav>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{task.source} · {task.visibility}</p>
          <h1 className="mt-2 font-display text-3xl tracking-[-0.02em]">{task.title}</h1>
          <p className="mt-1 font-mono text-xs text-muted">{task.repoUrl} @ {task.baseCommit}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip tone={TONE[task.status] ?? "neutral"}>{task.status}</StatusChip>
          {curator && task.status === "validated" ? <CuratorActions taskId={task.id} /> : null}
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["Language", task.language],
          ["License", task.license],
          ["Version", task.version],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border-subtle bg-panel p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{label}</p>
            <p className="mt-1 text-sm text-primary">{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-border-subtle bg-panel p-4">
        <h2 className="text-sm font-medium text-primary">Issue</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-secondary">{task.issueText}</p>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">test command (not shown to the agent)</p>
        <code className="mt-1 block overflow-x-auto rounded bg-inset px-3 py-2 font-mono text-[11px] text-secondary">{task.testCommand}</code>
      </section>

      {task.visibility !== "private" || task.submittedBy === current.id ? (
        <TaskProgress taskId={task.id} initial={events} />
      ) : null}

      {task.validation ? (
        <section className="rounded-xl border border-border-subtle bg-panel p-4">
          <h2 className="text-sm font-medium text-primary">Six gates</h2>
          <dl className="mt-3 grid gap-2 sm:grid-cols-3">
            {Object.entries(task.validation).filter(([key]) => key !== "checkedAt").map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded border border-border-subtle px-3 py-2 text-xs">
                <dt className="text-secondary">{key}</dt>
                <dd className={value ? "text-pass" : "text-fail"}>{value ? "pass" : "fail"}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {task.rejectionReason ? <p className="rounded border border-fail/40 bg-fail/5 px-4 py-3 text-xs text-fail">{task.rejectionReason}</p> : null}
    </div>
  );
}
