"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TaskSubmitForm() {
  const router = useRouter();
  const [state, setState] = useState<{ kind: "idle" | "sending" | "error"; message?: string }>({ kind: "idle" });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState({ kind: "sending" });
    const response = await fetch("/api/v1/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        repoUrl: form.get("repoUrl"),
        baseCommit: form.get("baseCommit"),
        issueText: form.get("issueText"),
        testCommand: form.get("testCommand"),
        visibility: form.get("visibility"),
        title: form.get("title") || undefined,
      }),
    }).catch(() => null);
    const body = response === null ? null : ((await response.json()) as { task?: { id: string }; error?: { message?: string } });
    if (response === null || !response.ok || body?.task === undefined) {
      setState({ kind: "error", message: body?.error?.message ?? "The task could not be queued." });
      return;
    }
    router.push(`/tasks/${body.task.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-border-subtle bg-panel p-5">
      <label className="block text-xs text-secondary">
        Title (optional)
        <input name="title" maxLength={120} className="mt-1 w-full rounded-md border border-border-subtle bg-app px-3 py-2 text-sm text-primary" placeholder="Fix the parser edge case" />
      </label>
      <label className="block text-xs text-secondary">
        GitHub repository URL
        <input name="repoUrl" required pattern="https://github\.com/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+" className="mt-1 w-full rounded-md border border-border-subtle bg-app px-3 py-2 font-mono text-xs text-primary" placeholder="https://github.com/owner/repo" />
      </label>
      <label className="block text-xs text-secondary">
        Base commit (hex)
        <input name="baseCommit" required pattern="[a-f0-9]{7,40}" className="mt-1 w-full rounded-md border border-border-subtle bg-app px-3 py-2 font-mono text-xs text-primary" placeholder="a1b2c3d" />
      </label>
      <label className="block text-xs text-secondary">
        Issue text
        <textarea name="issueText" required minLength={20} maxLength={8000} rows={6} className="mt-1 w-full rounded-md border border-border-subtle bg-app px-3 py-2 text-sm text-primary" placeholder="Describe the bug and the expected behavior." />
      </label>
      <label className="block text-xs text-secondary">
        Test command (single argv, allowlisted executable)
        <input name="testCommand" required className="mt-1 w-full rounded-md border border-border-subtle bg-app px-3 py-2 font-mono text-xs text-primary" placeholder="node --test test.js" />
      </label>
      <fieldset className="text-xs text-secondary">
        <legend>Visibility</legend>
        <label className="mt-2 flex items-center gap-2"><input type="radio" name="visibility" value="public" defaultChecked /> Community — public after validation and curator promotion</label>
        <label className="mt-1 flex items-center gap-2"><input type="radio" name="visibility" value="private" /> Private — only visible to you</label>
      </fieldset>
      {state.kind === "error" ? <p role="alert" className="rounded border border-fail/40 bg-fail/5 px-3 py-2 text-xs text-fail">{state.message}</p> : null}
      <button type="submit" disabled={state.kind === "sending"} className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-app disabled:opacity-60">
        {state.kind === "sending" ? "Queueing validation…" : "Submit for validation"}
      </button>
      <p className="text-[11px] leading-5 text-muted">
        Six gates run in the same sandbox: clone, install, test fails at base, deterministic ×3, time bounded, license. The test command is never shown to the agent.
      </p>
    </form>
  );
}
