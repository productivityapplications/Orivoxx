import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CapBanner } from "@/components/cap-banner";
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
  const requirements: RequirementRow[] = (task?.requirements ?? []).map((requirement) => ({
    ...requirement,
    status: outcomeStatus.get(requirement.id) ?? "UNVERIFIED",
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
