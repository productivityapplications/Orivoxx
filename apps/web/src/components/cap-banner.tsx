import { capLabel, formatScore } from "@/lib/format";

import { StatusChip } from "./status-chip";

export function CapBanner({
  capsApplied,
  appliedCap,
}: {
  capsApplied: string[];
  appliedCap: number | null;
}) {
  if (capsApplied.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Score cap"
      className="rounded-lg border border-fail/40 bg-fail/5 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone="capped">Capped</StatusChip>
        <p className="text-sm text-primary">
          A critical failure limited the overall score
          {appliedCap === null ? "" : ` to ${formatScore(appliedCap)}`}.
        </p>
      </div>
      <ul className="mt-2 space-y-1 text-xs text-secondary">
        {capsApplied.map((cap) => (
          <li key={cap} className="font-mono">
            {capLabel(cap)}
          </li>
        ))}
      </ul>
    </section>
  );
}
