"use client";

import { useId, useState } from "react";

import { requirementStatusTone, severityLabel } from "@/lib/format";

import { StatusChip } from "./status-chip";

export interface RequirementRow {
  id: string;
  title: string;
  description: string;
  severity: string;
  bench: string;
  status: string;
  checks: { type: string; path?: string; text?: string; name?: string }[];
}

function checkSummary(check: RequirementRow["checks"][number]): string {
  if (check.path !== undefined && check.text !== undefined) {
    return `${check.type} · ${check.path} contains ${JSON.stringify(check.text)}`;
  }

  if (check.path !== undefined) {
    return `${check.type} · ${check.path}`;
  }

  if (check.name !== undefined) {
    return `${check.type} · ${check.name}`;
  }

  return check.type;
}

export function RequirementList({ requirements }: { requirements: RequirementRow[] }) {
  const [open, setOpen] = useState<string | null>(requirements[0]?.id ?? null);
  const baseId = useId();

  return (
    <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-panel">
      {requirements.map((requirement) => {
        const expanded = open === requirement.id;
        const detailId = `${baseId}-${requirement.id}`;

        return (
          <li key={requirement.id}>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={detailId}
              onClick={() => setOpen(expanded ? null : requirement.id)}
              className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-left transition-colors hover:bg-raised"
            >
              <StatusChip tone={requirementStatusTone(requirement.status)}>
                {requirement.status}
              </StatusChip>
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[11px] text-muted">{requirement.id}</span>
                <span className="block text-sm text-primary">{requirement.title}</span>
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
                {requirement.bench} · {severityLabel(requirement.severity)}
              </span>
              <span aria-hidden="true" className="text-muted">
                {expanded ? "−" : "+"}
              </span>
            </button>

            {expanded ? (
              <div id={detailId} className="border-t border-border-subtle bg-app/40 px-4 py-3">
                <p className="text-xs leading-5 text-secondary">{requirement.description}</p>
                <dl className="mt-3 space-y-1.5">
                  <div className="flex gap-2 text-xs">
                    <dt className="w-16 shrink-0 text-muted">Rule</dt>
                    <dd className="font-mono text-secondary">
                      {requirement.checks.map(checkSummary).join(" · ") || "declared check"}
                    </dd>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <dt className="w-16 shrink-0 text-muted">Outcome</dt>
                    <dd className="text-secondary">
                      {requirement.status === "PASS"
                        ? "The declared check matched the produced repository."
                        : requirement.status === "FAIL"
                          ? "The declared check did not match the produced repository."
                          : requirement.status === "DRIFT"
                            ? "The declared structure no longer matches the ruleset."
                            : "No evidence was available for this requirement."}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
