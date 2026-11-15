import { formatBytes } from "@/lib/format";

import { CodeBlock } from "./code-block";

export function DiffView({
  diff,
}: {
  diff: {
    text: string;
    truncated: boolean;
    addedFiles: number;
    removedFiles: number;
    changedFiles: number;
    totalAddedLines: number;
    totalRemovedLines: number;
  };
}) {
  return (
    <section aria-label="Produced-code diff" className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-primary">Produced-code diff</h2>
        <p className="font-mono text-[11px] text-muted">
          {diff.addedFiles} added · {diff.changedFiles} changed · {diff.removedFiles} removed ·{" "}
          {diff.totalAddedLines} + / {diff.totalRemovedLines} − · {formatBytes(diff.text.length)}
        </p>
      </div>

      {diff.truncated ? (
        <p className="rounded border border-unverified/40 bg-unverified/5 px-3 py-2 text-xs text-unverified">
          The diff exceeded the stored byte, file, or per-file line budget. It is truncated;
          the scorecard above is complete.
        </p>
      ) : null}

      {diff.text.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-subtle px-4 py-6 text-center text-xs text-muted">
          The produced repository is identical to the starting repository.
        </p>
      ) : (
        <CodeBlock text={diff.text} label="unified diff" />
      )}
    </section>
  );
}
