import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AttributionCard } from "@/components/attribution-card";
import { CapBanner } from "@/components/cap-banner";
import { MetricsGrid } from "@/components/metrics-grid";
import { TraceView } from "@/components/trace-view";
import { CodeBlock } from "@/components/code-block";
import { DiffView } from "@/components/diff-view";
import { RequirementList, type RequirementRow } from "@/components/requirement-list";
import { ScoreBlock } from "@/components/score-block";
import { StatusChip } from "@/components/status-chip";
import { TallyChips } from "@/components/tally-chips";
import { VersionStrip } from "@/components/version-strip";
import { adapterKindLabel, adapterKindTone, formatDateTime, formatDuration } from "@/lib/format";
import { webResult } from "@/server/results";
import { taskDetail } from "@/server/tasks";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ resultId: string }>;
}): Promise<Metadata> {
  return { title: `Result ${(await params).resultId}` };
}

export default async function ResultPage({
  params,
}: {
  params: Promise<{ resultId: string }>;
}) {
  const { resultId } = await params;
  const read = await webResult(resultId);

  if (read.result === null) {
    notFound();
  }

  const result = read.result;
  const task = taskDetail(result.taskId);
  const outcomeStatus = new Map(
    result.score.requirements.map((requirement) => [requirement.id, requirement.status]),
  );
  const requirements: RequirementRow[] =
    task !== null
      ? task.requirements.map((requirement) => ({
          ...requirement,
          status: outcomeStatus.get(requirement.id) ?? "UNVERIFIED",
        }))
      : result.score.requirements.map((requirement) => ({
          id: requirement.id,
          title: requirement.id,
          description: "Real-repository task requirement.",
          severity: requirement.severity,
          bench: requirement.bench,
          status: requirement.status,
          checks: [],
        }));

  return (
    <div className="space-y-7">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/leaderboard" className="hover:text-secondary">
          Leaderboard
        </Link>{" "}
        /{" "}
        <Link href={`/benchmarks/${result.taskId}`} className="hover:text-secondary">
          {result.taskId}
        </Link>{" "}
        / <span className="text-secondary">{result.resultId.slice(0, 12)}…</span>
      </nav>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
            {result.resultId}
          </span>
          <StatusChip tone={adapterKindTone(result.adapter.kind)}>
            {adapterKindLabel(result.adapter.kind)}
          </StatusChip>
          <StatusChip tone={result.run.status === "completed" ? "pass" : "fail"}>
            {result.run.status}
          </StatusChip>
          {result.taskSuccess !== undefined ? (
            <StatusChip tone={result.taskSuccess ? "pass" : "fail"}>
              test {result.taskSuccess ? "passed" : "failed"}
            </StatusChip>
          ) : null}
          {result.chaos ? <StatusChip tone="unverified">{result.chaos.kind}</StatusChip> : null}
          {read.degraded ? <StatusChip tone="degraded">Store degraded</StatusChip> : null}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {task?.title ?? result.taskId}
            </h1>
            <p className="mt-1 text-sm text-secondary">
              {result.adapter.label} · {result.model?.name ?? "no model (fake baseline)"} ·{" "}
              {formatDuration(result.run.durationMs)} · {formatDateTime(result.createdAt)}
            </p>
          </div>
          <Link
            href={`/compare?task=${result.taskId}&a=${result.resultId}`}
            className="rounded-md border border-border-strong bg-raised px-3 py-1.5 text-xs text-primary hover:border-accent"
          >
            Compare
          </Link>
        </div>
      </header>

      <CapBanner capsApplied={result.capsApplied} appliedCap={result.appliedCap} />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <ScoreBlock overall={result.overall} benches={result.benches} />
        <div className="space-y-3">
          <div className="rounded-lg border border-border-subtle bg-panel p-4">
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted">Tally</p>
            <div className="mt-2">
              <TallyChips tally={result.tally} />
            </div>
            <p className="mt-3 text-[11px] leading-5 text-muted">
              UNVERIFIED earns zero but is counted separately from FAIL.
            </p>
          </div>
        </div>
      </div>

      {result.realTask ? (
        <section className="rounded-xl border border-border-subtle bg-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-primary">Repository task</h2>
            <span className="font-mono text-[10px] text-muted">{result.realTask.license} · {result.realTask.language}</span>
          </div>
          <p className="mt-2 font-mono text-[11px] text-secondary">{result.realTask.repoUrl}</p>
          <p className="mt-1 font-mono text-[10px] text-muted">base {result.realTask.baseCommit}</p>
          {result.test ? (
            <div className="mt-3 rounded-lg border border-border-subtle bg-app p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">test command</p>
              <code className="mt-1 block overflow-x-auto font-mono text-[11px] text-secondary">{result.test.command}</code>
              <p className={`mt-2 text-xs ${result.test.passed ? "text-pass" : "text-fail"}`}>
                exit {result.test.exitCode ?? "timeout"} · {result.test.durationMs}ms · {result.test.passed ? "PASS" : "FAIL"}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {result.metrics ? <MetricsGrid metrics={result.metrics} /> : null}

      <AttributionCard
        attribution={result.attribution ?? null}
        reason={
          result.attributionReason ??
          (result.trace === undefined ? "No trace was captured for this run." : null)
        }
        resultId={result.resultId}
      />

      <section aria-labelledby="trace-heading" className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="trace-heading" className="text-sm font-medium text-primary">
            Trace
          </h2>
          <div className="flex items-center gap-3 text-xs">
            {result.trace ? <span className="font-mono text-muted">{result.trace.length} events</span> : null}
            <Link href={`/results/${result.resultId}/trace`} className="text-accent-secondary hover:underline">
              Full trace →
            </Link>
          </div>
        </div>
        {result.trace ? (
          <TraceView trace={result.trace} limit={10} highlightStep={result.attribution?.evidence[0]?.stepIndex ?? undefined} />
        ) : (
          <p className="rounded-xl border border-dashed border-border-subtle px-4 py-6 text-center text-xs text-muted">
            No trace was captured for this run. Attribution is unavailable.
          </p>
        )}
      </section>

      <VersionStrip
        taskVersion={result.taskVersion}
        rulesetVersion={result.rulesetVersion}
        scoringConfigVersion={result.scoringConfigVersion}
        adapterVersion={result.adapterVersion}
        repositoryFingerprint={result.repositoryFingerprint}
      />

      <section aria-labelledby="requirements-heading" className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="requirements-heading" className="text-sm font-semibold text-primary">
            Requirement outcomes
          </h2>
          <p className="text-xs text-muted">
            Static checks · {requirements.length} declared · no produced code executed
          </p>
        </div>
        <RequirementList requirements={requirements} />
      </section>

      <DiffView diff={result.diff} />

      {result.run.exitCode !== null || result.run.status !== "completed" ? (
        <section aria-labelledby="run-heading" className="space-y-2">
          <h2 id="run-heading" className="text-sm font-semibold text-primary">
            Run summary
          </h2>
          <CodeBlock
            label="run record"
            maxHeight="12rem"
            text={JSON.stringify(
              {
                status: result.run.status,
                exitCode: result.run.exitCode,
                durationMs: result.run.durationMs,
                adapter: result.adapter,
                model: result.model,
              },
              null,
              2,
            )}
          />
        </section>
      ) : null}

      <p className="text-xs leading-5 text-muted">
        The score is reproducible from the task, ruleset, scoring configuration, and captured
        repository text. No model call contributed to it.
      </p>
    </div>
  );
}
