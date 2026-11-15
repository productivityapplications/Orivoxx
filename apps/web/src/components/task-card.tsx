import Link from "next/link";

import { difficultyLabel, formatScore } from "@/lib/format";

export interface TaskCardData {
  id: string;
  version: string;
  title: string;
  summary: string;
  difficulty: string;
  rulesetVersion: string;
  scoringConfigVersion: string;
  requirementCount: number;
  benchCounts: { spec: number; security: number };
  timeLimitSeconds: number;
}

export function TaskCard({ task, score }: { task: TaskCardData; score?: number }) {
  return (
    <Link
      href={`/benchmarks/${task.id}`}
      className="group flex flex-col rounded-lg border border-border-subtle bg-panel p-4 transition-colors hover:border-border-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
            {task.id} · v{task.version}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-primary group-hover:text-accent">
            {task.title}
          </h3>
        </div>
        {score === undefined ? null : (
          <span className="font-mono text-lg text-accent">{formatScore(score)}</span>
        )}
      </div>

      <p className="mt-2 line-clamp-3 text-xs leading-5 text-secondary">{task.summary}</p>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border-subtle pt-3 text-[11px]">
        <div>
          <dt className="text-muted">Difficulty</dt>
          <dd className="mt-0.5 text-secondary">{difficultyLabel(task.difficulty)}</dd>
        </div>
        <div>
          <dt className="text-muted">Requirements</dt>
          <dd className="mt-0.5 text-secondary">
            {task.requirementCount} · {task.benchCounts.spec}s / {task.benchCounts.security}sec
          </dd>
        </div>
        <div>
          <dt className="text-muted">Versions</dt>
          <dd className="mt-0.5 font-mono text-secondary">
            r{task.rulesetVersion} · c{task.scoringConfigVersion}
          </dd>
        </div>
      </dl>
    </Link>
  );
}
