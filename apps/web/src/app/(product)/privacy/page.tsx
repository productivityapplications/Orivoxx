import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 text-sm leading-6 text-secondary">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Privacy</h1>
        <p className="mt-2">
          Orivoxx is a read-only benchmark site with no accounts, no analytics, and no cookies.
          This page states what a stored result contains and what it never contains.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-primary">What is stored</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>A bounded scorecard: overall score, three bench scores, requirement outcomes, cap reasons, structural metrics.</li>
          <li>Run metadata: status, exit code, duration, adapter identity, and model identity.</li>
          <li>Version fields: task, ruleset, scoring configuration, adapter, and a repository fingerprint.</li>
          <li>The produced-code diff as bounded text: 256 KiB, 200 files, 400 lines per file.</li>
          <li>Redacted trace summaries: model timing, tokens, cost, tool names, paths, byte counts, and status/error class.</li>
          <li>Attribution and proof: layer × mode, evidence step indices, intervention, and the baseline/counterfactual scores.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-primary">What is never stored</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Full source trees, archives, or ZIP contents.</li>
          <li>Agent prompts, raw model responses, or provider request bodies.</li>
          <li>Provider API keys, store tokens, or secret candidates.</li>
          <li>Raw tool arguments/results, file contents, prompts, or the replay action log.</li>
        </ul>
        <p>
          Replay actions are held in harness memory for the organizer run, used to compute the
          counterfactual, and deleted. They are never written to the result store.
        </p>
        <p>
          Captured workspaces exclude <code className="font-mono text-xs">.env</code> files, keys,
          certificates, credentials, <code className="font-mono text-xs">.git</code>,{" "}
          <code className="font-mono text-xs">node_modules</code>, build output, binaries, and
          large generated content.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-primary">Where it lives and how long</h2>
        <p>
          Results are appended to a shared Upstash Redis store in deployment, or to a local
          append-only directory for organizer runs. Results are retained for 90 days. The store is
          append-only; a re-run produces a new row. The public site has no write or delete
          endpoint.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-primary">Model provider</h2>
        <p>
          The score path makes no model calls. Real adapter runs are organizer-executed and send
          the task specification and source context to OpenRouter through its OpenAI-compatible
          API. Provider-side processing and retention are governed by the provider&apos;s terms.
          Orivoxx does not claim provider-side zero retention.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-primary">Tracking</h2>
        <p>
          No analytics, no cookies, no third-party telemetry, no advertising identifiers. Server
          logs are limited to request ids, status, timing, and safe metrics.
        </p>
      </section>

      <p className="text-xs text-muted">
        Full detail: <Link href="/docs/results-retention" className="text-accent-secondary hover:underline">results and retention</Link>.
        This page is not legal advice.
      </p>
    </article>
  );
}
