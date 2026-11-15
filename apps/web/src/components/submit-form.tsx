"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface SubmitTask {
  id: string;
  title: string;
  summary: string;
  requirementCount: number;
}

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "error"; code: string; message: string };

export function SubmitForm({ tasks }: { tasks: SubmitTask[] }) {
  const router = useRouter();
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "taskboard");
  const [variant, setVariant] = useState<"compliant" | "regressed">("compliant");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: "running" });

    try {
      const response = await fetch("/api/v1/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId, variant }),
      });
      const body = (await response.json()) as {
        resultId?: string;
        error?: { code?: string; message?: string };
      };

      if (!response.ok || typeof body.resultId !== "string") {
        setState({
          kind: "error",
          code: body.error?.code ?? "run_failed",
          message: body.error?.message ?? "The run could not be completed.",
        });
        return;
      }

      router.push(`/results/${body.resultId}`);
    } catch {
      setState({
        kind: "error",
        code: "network_error",
        message: "The request could not be sent. Check your connection and try again.",
      });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-primary">1. Task</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {tasks.map((task) => (
            <label
              key={task.id}
              className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                taskId === task.id
                  ? "border-accent bg-raised"
                  : "border-border-subtle bg-panel hover:border-border-strong"
              }`}
            >
              <input
                type="radio"
                name="task"
                value={task.id}
                checked={taskId === task.id}
                onChange={() => setTaskId(task.id)}
                className="sr-only"
              />
              <span className="block font-mono text-[11px] text-muted">{task.id}</span>
              <span className="mt-0.5 block text-sm text-primary">{task.title}</span>
              <span className="mt-1 block text-xs leading-5 text-secondary">
                {task.requirementCount} requirements
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-primary">2. Fixture variant</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["compliant", "Compliant", "A repository that satisfies every declared check."],
              ["regressed", "Regressed", "A repository with deliberate critical failures and caps."],
            ] as const
          ).map(([value, label, description]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                variant === value
                  ? "border-accent bg-raised"
                  : "border-border-subtle bg-panel hover:border-border-strong"
              }`}
            >
              <input
                type="radio"
                name="variant"
                value={value}
                checked={variant === value}
                onChange={() => setVariant(value)}
                className="sr-only"
              />
              <span className="block text-sm text-primary">{label}</span>
              <span className="mt-0.5 block text-xs leading-5 text-secondary">{description}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded-lg border border-border-subtle bg-panel p-4">
        <p className="text-xs leading-5 text-secondary">
          No model call. The fake baseline materializes a checked-in fixture and scores it
          deterministically. Real adapter runs are organizer-executed.
        </p>
      </div>

      {state.kind === "error" ? (
        <div
          role="alert"
          className="rounded-lg border border-fail/40 bg-fail/5 px-4 py-3 text-sm text-fail"
        >
          <span className="font-mono text-xs uppercase tracking-[0.08em]">{state.code}</span>
          <p className="mt-1 text-secondary">{state.message}</p>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={state.kind === "running"}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-app transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state.kind === "running" ? "Running benchmark…" : "Run fake baseline"}
        </button>
        {state.kind === "running" ? (
          <span role="status" className="text-xs text-secondary">
            Capturing and scoring the fixture.
          </span>
        ) : null}
      </div>
    </form>
  );
}
