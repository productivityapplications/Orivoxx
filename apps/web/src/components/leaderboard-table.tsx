import Link from "next/link";

import {
  adapterKindLabel,
  adapterKindTone,
  capLabel,
  formatDateTime,
  formatScore,
  shortId,
} from "@/lib/format";

import { StatusChip } from "./status-chip";

export interface LeaderboardRow {
  resultId: string;
  createdAt: string;
  taskId: string;
  overall: number;
  benches: { spec: number; security: number; maintainability: number };
  capsApplied: string[];
  adapter: { id: string; label: string; kind: string };
  model: { name: string } | null;
}

export function LeaderboardTable({
  rows,
  caption,
  showTask = true,
}: {
  rows: LeaderboardRow[];
  caption: string;
  showTask?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-subtle">
      <table className="w-full min-w-[60rem] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border-subtle bg-panel text-[11px] uppercase tracking-[0.08em] text-muted">
            <th scope="col" className="px-3 py-2 font-medium">
              #
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Score
            </th>
            {showTask ? (
              <th scope="col" className="px-3 py-2 font-medium">
                Task
              </th>
            ) : null}
            <th scope="col" className="px-3 py-2 font-medium">
              Adapter
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Model
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Spec
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Sec
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Maint
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Flags
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Created
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle bg-panel/60">
          {rows.map((row, index) => (
            <tr key={row.resultId} className="transition-colors hover:bg-raised">
              <td className="px-3 py-2.5 font-mono text-xs text-muted">{index + 1}</td>
              <td className="px-3 py-2.5">
                <Link
                  href={`/results/${row.resultId}`}
                  className="font-mono text-base text-primary hover:text-accent"
                  title={row.resultId}
                >
                  {formatScore(row.overall)}
                </Link>
              </td>
              {showTask ? (
                <td className="px-3 py-2.5">
                  <Link href={`/benchmarks/${row.taskId}`} className="text-secondary hover:text-primary">
                    {row.taskId}
                  </Link>
                </td>
              ) : null}
              <td className="px-3 py-2.5">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-secondary">{row.adapter.label}</span>
                  <StatusChip tone={adapterKindTone(row.adapter.kind)}>
                    {adapterKindLabel(row.adapter.kind)}
                  </StatusChip>
                </div>
              </td>
              <td className="px-3 py-2.5 font-mono text-[11px] text-muted">
                {row.model?.name ?? "no model"}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs text-secondary">
                {formatScore(row.benches.spec)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs text-secondary">
                {formatScore(row.benches.security)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-xs text-secondary">
                {formatScore(row.benches.maintainability)}
              </td>
              <td className="px-3 py-2.5">
                {row.capsApplied.length > 0 ? (
                  <span title={row.capsApplied.map(capLabel).join("; ")}>
                    <StatusChip tone="capped">Capped</StatusChip>
                  </span>
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-xs text-muted">
                <span title={row.createdAt}>{formatDateTime(row.createdAt)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border-subtle px-3 py-2 font-mono text-[11px] text-muted">
        ids: {rows.map((row) => shortId(row.resultId)).join(" · ")}
      </p>
    </div>
  );
}
