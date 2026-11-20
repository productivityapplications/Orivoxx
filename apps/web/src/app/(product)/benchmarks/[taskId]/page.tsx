import type { Metadata } from "next";
import Link from "next/link";
import { groupReliability } from "@orivoxx/results";
import { notFound } from "next/navigation";

import { CodeBlock } from "@/components/code-block";
import { EmptyState } from "@/components/empty-state";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { StatusChip } from "@/components/status-chip";
import { difficultyLabel, formatBytes, severityLabel } from "@/lib/format";
import { webLeaderboard } from "@/server/results";
import { taskDetail } from "@/server/tasks";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ taskId: string }>;
}): Promise<Metadata> {
  const { taskId } = await params;
  const task = taskDetail(taskId);

  return { title: task?.title ?? "Task not found" };
}

export default async function TaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const task = taskDetail(taskId);

  if (task === null) {
    notFound();
  }

  const leaderboard = await webLeaderboard({ taskId: task.id, limit: 5, kind: "all" });
  const profiles = new Map(
    groupReliability(leaderboard.entries).map((group) => [
      `${group.adapterId}:${group.taskId}`,
      group.profile,
    ]),
  );

  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/benchmarks" className="hover:text-secondary">
          Benchmarks
        </Link>{" "}
        / <span className="text-secondary">{task.id}</span>
      </nav>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
            {task.id} · task {task.version} · ruleset {task.rulesetVersion} · scoring{" "}
            {task.scoringConfigVersion}
          </span>
          <StatusChip tone="neutral">{difficultyLabel(task.difficulty)}</StatusChip>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-secondary">{task.summary}</p>
        <div className="flex flex-wrap gap-2">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="rounded border border-border-subtle px-2 py-0.5 font-mono text-[11px] text-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      </header>

      <section aria-labelledby="requirements-heading" className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="requirements-heading" className="text-sm font-semibold text-primary">
            Requirements ({task.requirements.length})
          </h2>
          <p className="text-xs text-muted">
            {task.benchCounts.spec} spec · {task.benchCounts.security} security · pass ≥{" "}
            {task.passThreshold} · {task.timeLimitSeconds}s limit · network {task.network}
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border-subtle">
          <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
            <caption className="sr-only">Declared requirements and their checks</caption>
            <thead>
              <tr className="border-b border-border-subtle bg-panel text-[11px] uppercase tracking-[0.08em] text-muted">
                <th scope="col" className="px-3 py-2 font-medium">
                  Id
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Requirement
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Bench
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Severity
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Declared check
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle bg-panel/60">
              {task.requirements.map((requirement) => (
                <tr key={requirement.id} className="align-top">
                  <td className="px-3 py-2.5 font-mono text-[11px] text-muted">{requirement.id}</td>
                  <td className="px-3 py-2.5">
                    <span className="block text-xs text-primary">{requirement.title}</span>
                    <span className="mt-0.5 block text-[11px] leading-5 text-muted">
                      {requirement.description}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-secondary">{requirement.bench}</td>
                  <td className="px-3 py-2.5 text-xs text-secondary">
                    {severityLabel(requirement.severity)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-secondary">
                    {requirement.checks.map((check) => (
                      <span key={`${check.type}-${check.path ?? check.name ?? ""}`} className="block">
                        {check.type}
                        {check.path === undefined ? "" : ` · ${check.path}`}
                        {check.text === undefined ? "" : ` · ${JSON.stringify(check.text)}`}
                        {check.name === undefined ? "" : ` · ${check.name}`}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="starting-files-heading" className="space-y-2">
        <h2 id="starting-files-heading" className="text-sm font-semibold text-primary">
          Starting files
        </h2>
        <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-panel">
          {task.startingFiles.map((file) => (
            <li key={file.path} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="font-mono text-xs text-secondary">{file.path}</span>
              <span className="font-mono text-[11px] text-muted">{formatBytes(file.size)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="spec-heading" className="space-y-2">
        <h2 id="spec-heading" className="text-sm font-semibold text-primary">
          PROJECT_SPEC.md
        </h2>
        <CodeBlock text={task.specText} label="task specification" maxHeight="22rem" />
      </section>

      <section aria-labelledby="adapters-heading" className="space-y-2">
        <h2 id="adapters-heading" className="text-sm font-semibold text-primary">
          Adapters
        </h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ["fake", "Baseline", "Materializes a checked-in fixture. No model, no network."],
            ["claude-code-openrouter", "Organizer-run", "Claude Code routed through OpenRouter via the sandbox proxy."],
            ["codex-openrouter", "Organizer-run", "OpenAI Codex CLI routed through OpenRouter via the sandbox proxy."],
            ["aider-openrouter", "Organizer-run", "Aider 0.86.2 pinned in the sandbox image."],
          ].map(([id, kind, body]) => (
            <div key={id} className="rounded-lg border border-border-subtle bg-panel p-3">
              <p className="font-mono text-xs text-primary">{id}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-muted">{kind}</p>
              <p className="mt-1.5 text-xs leading-5 text-secondary">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="task-leaderboard-heading" className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="task-leaderboard-heading" className="text-sm font-semibold text-primary">
            Leaderboard
          </h2>
          <Link href="/submit" className="text-xs text-accent-secondary hover:underline">
            Run the fake baseline
          </Link>
        </div>

        {leaderboard.entries.length === 0 ? (
          <EmptyState
            title="No results for this task yet"
            description="Run the fake baseline to create a scorecard, or open the global leaderboard for other tasks."
            action={{ href: "/leaderboard", label: "Open leaderboard" }}
          />
        ) : (
          <LeaderboardTable
            rows={leaderboard.entries}
            caption={`Leaderboard for ${task.id}`}
            showTask={false}
            reliability={profiles}
          />
        )}
      </section>
    </div>
  );
}
