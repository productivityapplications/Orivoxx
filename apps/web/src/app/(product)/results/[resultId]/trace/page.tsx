import { notFound } from "next/navigation";
import Link from "next/link";

import { TraceView } from "@/components/trace-view";
import { webResult } from "@/server/results";

export const dynamic = "force-dynamic";

export default async function TracePage({ params }: { params: Promise<{ resultId: string }> }) {
  const { resultId } = await params;
  const read = await webResult(resultId);

  if (read.result === null) {
    notFound();
  }

  const result = read.result;

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href={`/results/${resultId}`} className="hover:text-secondary">Result</Link> / Trace
      </nav>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{result.adapter.label}</p>
          <h1 className="mt-1 font-display text-3xl tracking-[-0.02em]">Trace timeline</h1>
          <p className="mt-1 text-sm text-secondary">
            {result.trace?.length ?? 0} events · tool arguments and results are redacted summaries
          </p>
        </div>
        <Link href={`/results/${resultId}`} className="text-xs text-accent-secondary hover:underline">
          Back to result →
        </Link>
      </header>
      {result.trace ? (
        <TraceView trace={result.trace} />
      ) : (
        <p className="rounded-xl border border-dashed border-border-subtle px-4 py-10 text-center text-sm text-muted">
          No trace was captured for this run.
        </p>
      )}
    </div>
  );
}
