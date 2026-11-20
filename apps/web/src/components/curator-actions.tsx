"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CuratorActions({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function promote() {
    setBusy(true);
    await fetch(`/api/v1/tasks/${taskId}/promote`, { method: "PATCH" });
    setBusy(false);
    router.refresh();
  }

  async function reject() {
    setBusy(true);
    await fetch(`/api/v1/tasks/${taskId}/reject`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "Rejected by curator." }) });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button onClick={promote} disabled={busy} className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-app disabled:opacity-60">Promote</button>
      <button onClick={reject} disabled={busy} className="rounded-full border border-fail/40 px-3 py-1.5 text-xs text-fail disabled:opacity-60">Reject</button>
    </div>
  );
}
