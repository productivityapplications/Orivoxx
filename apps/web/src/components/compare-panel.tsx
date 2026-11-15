import Link from "next/link";

import { adapterKindLabel, adapterKindTone, benchLabel, formatDelta, formatScore } from "@/lib/format";

import { StatusChip } from "./status-chip";

export interface CompareSide {
  resultId: string;
  adapter: { label: string; kind: string };
  model: { name: string } | null;
  overall: number;
  benches: { spec: number; security: number; maintainability: number };
  tally: { passed: number; failed: number; drifted: number; unverified: number };
  capsApplied: string[];
}

export interface CompareRow {
  id: string;
  title: string;
  bench: string;
  a: string;
  b: string;
}

const BENCH_KEYS = ["spec", "security", "maintainability"] as const;

function SideCard({ side, label }: { side: CompareSide; label: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{label}</p>
        <StatusChip tone={adapterKindTone(side.adapter.kind)}>
          {adapterKindLabel(side.adapter.kind)}
        </StatusChip>
      </div>
      <p className="mt-2 text-sm text-primary">{side.adapter.label}</p>
      <p className="mt-0.5 font-mono text-[11px] text-muted">
        {side.model?.name ?? "no model"}
      </p>
      <p className="mt-3 font-mono text-4xl text-primary">{formatScore(side.overall)}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border-subtle pt-3">
        {BENCH_KEYS.map((key) => (
          <div key={key}>
            <dt className="text-[11px] text-muted">{benchLabel(key)}</dt>
            <dd className="font-mono text-xs text-secondary">{formatScore(side.benches[key])}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <StatusChip tone="pass">{side.tally.passed} pass</StatusChip>
        <StatusChip tone="fail">{side.tally.failed} fail</StatusChip>
        <StatusChip tone="unverified">{side.tally.unverified} unverified</StatusChip>
        {side.capsApplied.length > 0 ? <StatusChip tone="capped">capped</StatusChip> : null}
      </div>
      <Link
        href={`/results/${side.resultId}`}
        className="mt-3 inline-block text-xs text-accent-secondary hover:underline"
      >
        Open result
      </Link>
    </div>
  );
}

export function ComparePanel({ a, b, rows }: { a: CompareSide; b: CompareSide; rows: CompareRow[] }) {
  const sameModel =
    a.model?.name !== undefined && a.model?.name === b.model?.name;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone={sameModel ? "pass" : "unverified"}>
          {sameModel ? "Same model" : "Different model"}
        </StatusChip>
        <span className="text-xs text-secondary">
          {sameModel
            ? `${a.model?.name ?? "unknown"} held constant; only the harness varies.`
            : "The harness and the model both differ, so the score gap is not attributable to one."}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SideCard side={a} label="A" />
        <SideCard side={b} label="B" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Bench deltas, B minus A</caption>
          <thead>
            <tr className="border-b border-border-subtle bg-panel text-[11px] uppercase tracking-[0.08em] text-muted">
              <th scope="col" className="px-3 py-2 font-medium">
                Bench
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                A
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                B
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                B − A
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle bg-panel/60">
            <tr>
              <th scope="row" className="px-3 py-2 font-medium text-secondary">
                Overall
              </th>
              <td className="px-3 py-2 text-right font-mono text-xs">{formatScore(a.overall)}</td>
              <td className="px-3 py-2 text-right font-mono text-xs">{formatScore(b.overall)}</td>
              <td className="px-3 py-2 text-right font-mono text-xs text-primary">
                {formatDelta(b.overall - a.overall)}
              </td>
            </tr>
            {BENCH_KEYS.map((key) => (
              <tr key={key}>
                <th scope="row" className="px-3 py-2 font-medium text-secondary">
                  {benchLabel(key)}
                </th>
                <td className="px-3 py-2 text-right font-mono text-xs">
                  {formatScore(a.benches[key])}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs">
                  {formatScore(b.benches[key])}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-primary">
                  {formatDelta(b.benches[key] - a.benches[key])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-subtle">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <caption className="sr-only">Requirement outcomes for both results</caption>
          <thead>
            <tr className="border-b border-border-subtle bg-panel text-[11px] uppercase tracking-[0.08em] text-muted">
              <th scope="col" className="px-3 py-2 font-medium">
                Requirement
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Bench
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                A
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                B
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle bg-panel/60">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2">
                  <span className="block font-mono text-[11px] text-muted">{row.id}</span>
                  <span className="text-xs text-secondary">{row.title}</span>
                </td>
                <td className="px-3 py-2 text-xs text-muted">{row.bench}</td>
                <td className="px-3 py-2">
                  <StatusChip tone={statusTone(row.a)}>{row.a}</StatusChip>
                </td>
                <td className="px-3 py-2">
                  <StatusChip tone={statusTone(row.b)}>{row.b}</StatusChip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function statusTone(status: string): "pass" | "fail" | "drift" | "unverified" | "neutral" {
  switch (status) {
    case "PASS":
      return "pass";
    case "FAIL":
      return "fail";
    case "DRIFT":
      return "drift";
    case "UNVERIFIED":
      return "unverified";
    default:
      return "neutral";
  }
}
