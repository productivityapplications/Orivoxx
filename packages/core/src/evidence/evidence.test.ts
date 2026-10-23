import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { EvidenceSchema } from "../contracts";
import {
  buildEvidenceRegistry,
  deriveEvidenceFingerprint,
} from "./evidence";
import { EvidenceValidationError, type EvidenceDraft } from "./types";

function draft(overrides: Partial<EvidenceDraft> = {}): EvidenceDraft {
  return {
    type: "text_marker",
    origin: "deterministic",
    path: "src/a.ts",
    startLine: 2,
    summary: "Required text marker present.",
    requirementIdHint: "REQ-A",
    checkType: "text_contains",
    ...overrides,
  };
}

describe("buildEvidenceRegistry", () => {
  it("assigns IDs deterministically for the same input", () => {
    const drafts = [
      draft({
        type: "file_presence",
        path: "src/b.ts",
        summary: "File exists at src/b.ts.",
        requirementIdHint: "REQ-B",
        checkType: "file_exists",
        startLine: undefined,
      }),
      draft(),
    ];

    const first = buildEvidenceRegistry(drafts, "snapshot");
    const second = buildEvidenceRegistry([...drafts].reverse(), "snapshot");

    expect(first.records.map((record) => record.id)).toEqual(["EV-001", "EV-002"]);
    expect(second.records).toEqual(first.records);
    expect(first.byRequirement.get("REQ-A")).toEqual(["EV-001"]);
  });

  it("coalesces exact duplicate drafts and keeps both requirement mappings", () => {
    const registry = buildEvidenceRegistry(
      [
        draft({ requirementIdHint: "REQ-A" }),
        draft({ requirementIdHint: "REQ-B" }),
      ],
      "snapshot",
    );

    expect(registry.records).toHaveLength(1);
    expect(registry.byRequirement.get("REQ-A")).toEqual(["EV-001"]);
    expect(registry.byRequirement.get("REQ-B")).toEqual(["EV-001"]);
    expect(registry.notes).toHaveLength(1);
  });

  it("validates every produced record against EvidenceSchema", () => {
    const registry = buildEvidenceRegistry(
      [
        draft(),
        draft({
          type: "dependency_state",
          path: "package.json",
          summary: "Declared dependency present.",
          requirementIdHint: "REQ-B",
          checkType: "dependency_present",
          startLine: undefined,
        }),
      ],
      "snapshot",
    );

    for (const record of registry.records) {
      expect(EvidenceSchema.safeParse(record).success).toBe(true);
    }
  });

  it("derives the fingerprint from the snapshot and content-free draft fields", () => {
    const sample = draft();
    const registry = buildEvidenceRegistry([sample], "snapshot");
    const expected = createHash("sha256")
      .update(
        `snapshot:${sample.type}:${sample.path ?? ""}:${sample.startLine ?? 0}:${sample.summary}`,
        "utf8",
      )
      .digest("hex");

    expect(registry.records[0]?.fingerprint).toBe(expected);
    expect(deriveEvidenceFingerprint("snapshot", sample)).toBe(expected);
  });

  it("returns an empty registry for empty input", () => {
    const registry = buildEvidenceRegistry([], "snapshot");

    expect(registry.records).toEqual([]);
    expect(registry.byId.size).toBe(0);
    expect(registry.byRequirement.size).toBe(0);
    expect(registry.notes).toEqual([]);
  });

  it("zero-pads IDs to three digits", () => {
    const drafts = Array.from({ length: 12 }, (_, index) =>
      draft({
        path: `src/${String(index).padStart(2, "0")}.ts`,
        summary: `File exists at src/${String(index).padStart(2, "0")}.ts.`,
        type: "file_presence",
        checkType: "file_exists",
        startLine: undefined,
      }),
    );
    const registry = buildEvidenceRegistry(drafts, "snapshot");

    expect(registry.records[0]?.id).toBe("EV-001");
    expect(registry.records[11]?.id).toBe("EV-012");
  });

  it("throws a structured error for invalid evidence", () => {
    expect(() =>
      buildEvidenceRegistry(
        [draft({ summary: "" })],
        "snapshot",
      ),
    ).toThrow(EvidenceValidationError);

    try {
      buildEvidenceRegistry([draft({ summary: "" })], "snapshot");
    } catch (error) {
      expect(error).toBeInstanceOf(EvidenceValidationError);
      expect((error as EvidenceValidationError).fieldPath).toBe("summary");
    }
  });

  it("throws a structured error for an empty snapshot fingerprint", () => {
    expect(() => buildEvidenceRegistry([], "")).toThrow(EvidenceValidationError);
  });
});
