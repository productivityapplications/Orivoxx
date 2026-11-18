import type { Metadata } from "next";

import { SubmitForm } from "@/components/submit-form";
import { taskSummaries } from "@/server/tasks";

export const metadata: Metadata = {
  title: "Submit a run",
};

export const dynamic = "force-dynamic";

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ chaos?: string }>;
}) {
  const { chaos } = await searchParams;
  const tasks = taskSummaries().map((task) => ({
    id: task.id,
    title: task.title,
    summary: task.summary,
    requirementCount: task.requirementCount,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Submit a run</h1>
        <p className="mt-2 text-sm leading-6 text-secondary">
          The public path runs the fake baseline: a checked-in fixture materialized through the
          same capture and scoring pipeline as a real run. It creates a real, immutable result.
        </p>
      </header>

      {chaos !== undefined ? (
        <div className="rounded-xl border border-unverified/40 bg-unverified/5 p-4 text-xs leading-6 text-unverified">
          Chaos mode <span className="font-mono">{chaos}</span> is organizer-executed. The public form
          creates the deterministic baseline only. Run it from the repository with:
          <code className="mt-2 block font-mono text-[11px] text-secondary">
            pnpm bench:run --task {tasks[0]?.id ?? "taskboard"} --adapter python-openrouter --chaos {chaos}
          </code>
        </div>
      ) : null}

      <SubmitForm tasks={tasks} />

      <section className="rounded-lg border border-border-subtle bg-panel p-4">
        <h2 className="text-sm font-semibold text-primary">What happens next</h2>
        <ol className="mt-2 space-y-1 text-xs leading-5 text-secondary">
          <li>1. The fixture is written to an ephemeral workspace.</li>
          <li>2. The workspace is captured, path-checked, redacted, and fingerprinted.</li>
          <li>3. The declared checks run statically against the captured text.</li>
          <li>4. The scorecard is appended to the store and opened in the result explorer.</li>
        </ol>
      </section>
    </div>
  );
}
