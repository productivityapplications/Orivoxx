"use client";

import { useEffect, useState } from "react";

interface Event { gate: string; status: string; detail: string; at: string }

export function TaskProgress({ taskId, initial }: { taskId: string; initial: Event[] }) {
  const [events, setEvents] = useState(initial);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      const response = await fetch(`/api/v1/tasks/${taskId}`).catch(() => null);
      if (response === null || !response.ok) return;
      const body = (await response.json()) as { task?: { status?: string }; validationEvents?: Event[] };
      if (stopped) return;
      if (body.task?.status !== undefined) setStatus(body.task.status);
      if (Array.isArray(body.validationEvents)) setEvents(body.validationEvents);
    };
    const timer = setInterval(poll, 3000);
    void poll();
    return () => { stopped = true; clearInterval(timer); };
  }, [taskId]);

  return (
    <section aria-label="Validation progress" className="rounded-xl border border-border-subtle bg-panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-primary">Validation gates</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{status || "polling"}</span>
      </div>
      {events.length === 0 ? (
        <p className="mt-3 text-xs text-muted">Waiting for the validation worker. This page polls every 3 seconds.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {events.map((event, index) => (
            <li key={`${event.gate}-${index}`} className="flex items-start gap-3 text-xs">
              <span className={`mt-1 h-1.5 w-1.5 rounded-full ${event.status === "pass" ? "bg-pass" : event.status === "fail" ? "bg-fail" : "bg-unverified"}`} />
              <div>
                <p className="font-mono text-[10px] text-muted">{event.gate} · {event.status}</p>
                <p className="text-secondary">{event.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
