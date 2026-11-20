import type { Metadata } from "next";
import Link from "next/link";

import { TaskSubmitForm } from "@/components/task-submit-form";
import { githubOAuthConfigured, viewer } from "@/server/auth";

export const metadata: Metadata = { title: "Submit a task" };
export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  const current = await viewer();
  const oauth = githubOAuthConfigured();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">\ COMMUNITY TASKS \</p>
        <h1 className="mt-3 font-display text-4xl tracking-[-0.03em]">Submit a repository task.</h1>
        <p className="mt-3 text-sm leading-7 text-secondary">
          A real GitHub repo, a base commit, an issue, and one test command. Six mechanical gates run
          in the same sandbox before the task is usable. Community tasks become public only after a
          curator promotes them; private tasks stay visible only to you.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-subtle bg-panel px-4 py-3 text-xs text-secondary">
        <span className="font-mono text-[10px] uppercase text-muted">identity</span>
        <span>{current.username ?? `anonymous · ${current.id.slice(0, 12)}…`}</span>
        {current.username === null && oauth ? (
          <a href="/api/auth/github" className="ml-auto rounded-full border border-border-strong px-3 py-1.5 text-primary hover:border-accent">
            Sign in with GitHub
          </a>
        ) : null}
        {!oauth ? <span className="ml-auto text-muted">GitHub OAuth not configured; anonymous token active.</span> : null}
      </div>

      <TaskSubmitForm />

      <div className="rounded-xl border border-border-subtle bg-panel p-4 text-xs leading-6 text-secondary">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">limits</p>
        <p className="mt-2">3 pending validations per user · 10 per 24 hours · 20 globally per 24 hours.</p>
        <p className="mt-1">Test commands must start with pytest, python, python3, npm, yarn, pnpm, node, cargo, go, or make; no shell operators.</p>
        <Link href="/tasks/mine" className="mt-2 inline-block text-accent-secondary hover:underline">Your submissions →</Link>
      </div>
    </div>
  );
}
