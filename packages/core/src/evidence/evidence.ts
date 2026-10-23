import { createHash } from "node:crypto";

import { EvidenceSchema, type Evidence } from "../contracts/index.js";
import type { EvidenceDraft, EvidenceRegistry } from "./types.js";
import { EvidenceValidationError } from "./types.js";

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function compareEvidenceIds(left: string, right: string): number {
  const leftSuffix = left.startsWith("EV-") ? Number.parseInt(left.slice(3), 10) : Number.NaN;
  const rightSuffix = right.startsWith("EV-") ? Number.parseInt(right.slice(3), 10) : Number.NaN;

  if (Number.isInteger(leftSuffix) && Number.isInteger(rightSuffix)) {
    return leftSuffix - rightSuffix;
  }

  return compareStrings(left, right);
}

function compareDrafts(left: EvidenceDraft, right: EvidenceDraft): number {
  return (
    compareStrings(left.requirementIdHint ?? "", right.requirementIdHint ?? "") ||
    compareStrings(left.checkType ?? "", right.checkType ?? "") ||
    compareStrings(left.path ?? "", right.path ?? "") ||
    (left.startLine ?? 0) - (right.startLine ?? 0) ||
    compareStrings(left.summary, right.summary) ||
    compareStrings(left.type, right.type) ||
    (left.endLine ?? 0) - (right.endLine ?? 0)
  );
}

function draftKey(draft: EvidenceDraft): string {
  return [draft.type, draft.path ?? "", String(draft.startLine ?? 0), draft.summary].join("\u0000");
}

export function deriveEvidenceFingerprint(
  snapshotFingerprint: string,
  draft: EvidenceDraft,
): string {
  return createHash("sha256")
    .update(
      `${snapshotFingerprint}:${draft.type}:${draft.path ?? ""}:${draft.startLine ?? 0}:${draft.summary}`,
      "utf8",
    )
    .digest("hex");
}

function throwValidationError(issues: readonly { path: PropertyKey[]; message: string }[]): never {
  const firstIssue = issues[0];
  const fieldPath =
    firstIssue !== undefined && firstIssue.path.length > 0
      ? firstIssue.path.map(String).join(".")
      : "<root>";

  throw new EvidenceValidationError(
    fieldPath,
    firstIssue?.message ?? "Unknown schema validation failure.",
  );
}

export function buildEvidenceRegistry(
  drafts: EvidenceDraft[],
  snapshotFingerprint: string,
): EvidenceRegistry {
  if (snapshotFingerprint.length === 0) {
    throw new EvidenceValidationError(
      "<snapshotFingerprint>",
      "Snapshot fingerprint must not be empty.",
    );
  }

  const sortedDrafts = [...drafts].sort(compareDrafts);
  const notes: string[] = [];
  const coalesced: Array<{ draft: EvidenceDraft; requirementHints: Set<string> }> = [];
  const indexByKey = new Map<string, number>();

  for (const draft of sortedDrafts) {
    const key = draftKey(draft);
    const existingIndex = indexByKey.get(key);

    if (existingIndex === undefined) {
      indexByKey.set(key, coalesced.length);
      coalesced.push({
        draft,
        requirementHints:
          draft.requirementIdHint === undefined
            ? new Set<string>()
            : new Set<string>([draft.requirementIdHint]),
      });
      continue;
    }

    notes.push(`Coalesced duplicate ${draft.type} evidence draft.`);
    const existing = coalesced[existingIndex];

    if (existing !== undefined && draft.requirementIdHint !== undefined) {
      existing.requirementHints.add(draft.requirementIdHint);
    }
  }

  const records: Evidence[] = [];
  const byId = new Map<string, Evidence>();
  const byRequirement = new Map<string, Set<string>>();

  for (let index = 0; index < coalesced.length; index += 1) {
    const entry = coalesced[index];

    if (entry === undefined) {
      continue;
    }

    const id = `EV-${String(index + 1).padStart(3, "0")}`;
    const candidate = {
      id,
      type: entry.draft.type,
      origin: entry.draft.origin,
      ...(entry.draft.path === undefined ? {} : { path: entry.draft.path }),
      ...(entry.draft.startLine === undefined ? {} : { startLine: entry.draft.startLine }),
      ...(entry.draft.endLine === undefined ? {} : { endLine: entry.draft.endLine }),
      summary: entry.draft.summary,
      fingerprint: deriveEvidenceFingerprint(snapshotFingerprint, entry.draft),
    };
    const parsed = EvidenceSchema.safeParse(candidate);

    if (!parsed.success) {
      throwValidationError(parsed.error.issues);
    }

    const record = parsed.data;
    records.push(record);
    byId.set(record.id, record);

    for (const requirementId of entry.requirementHints) {
      const ids = byRequirement.get(requirementId) ?? new Set<string>();
      ids.add(record.id);
      byRequirement.set(requirementId, ids);
    }
  }

  const sortedByRequirement = new Map<string, string[]>();

  for (const [requirementId, ids] of byRequirement) {
    sortedByRequirement.set(requirementId, [...ids].sort(compareEvidenceIds));
  }

  return { records, byId, byRequirement: sortedByRequirement, notes };
}
