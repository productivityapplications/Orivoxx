import { describe, expect, it } from "vitest";

import type { CapturedFile } from "./contracts.js";
import { buildProducedDiff, DIFF_DEFAULTS } from "./diff.js";

function produced(path: string, content: string): CapturedFile {
  return {
    path,
    content,
    byteSize: content.length,
    lineCount: content.split("\n").length,
    fingerprint: "a".repeat(64),
    language: "typescript",
    redacted: false,
  };
}

function starting(path: string, content: string) {
  return { path, content };
}

describe("produced-code diff", () => {
  it("emits an added-file hunk from /dev/null", () => {
    const diff = buildProducedDiff([], [produced("src/new.ts", "export const a = 1;\n")]);

    expect(diff.addedFiles).toBe(1);
    expect(diff.changedFiles).toBe(0);
    expect(diff.removedFiles).toBe(0);
    expect(diff.text).toContain("--- /dev/null");
    expect(diff.text).toContain("+++ b/src/new.ts");
    expect(diff.text).toContain("@@ -0,0 +1,1 @@");
    expect(diff.text).toContain("+export const a = 1;");
  });

  it("emits a removed-file hunk to /dev/null", () => {
    const diff = buildProducedDiff(
      [starting("src/old.ts", "export const old = 1;\n")],
      [],
    );

    expect(diff.removedFiles).toBe(1);
    expect(diff.text).toContain("--- a/src/old.ts");
    expect(diff.text).toContain("+++ /dev/null");
    expect(diff.text).toContain("-export const old = 1;");
  });

  it("keeps unchanged files out of the diff", () => {
    const source = "export const a = 1;\n";
    const diff = buildProducedDiff(
      [starting("src/a.ts", source)],
      [produced("src/a.ts", source)],
    );

    expect(diff.text).toBe("");
    expect(diff.files).toEqual([]);
    expect(diff.addedFiles + diff.changedFiles + diff.removedFiles).toBe(0);
  });

  it("produces a minimal hunk for a single-line change", () => {
    const diff = buildProducedDiff(
      [starting("src/a.ts", "line one\nline two\nline three\nline four\n")],
      [produced("src/a.ts", "line one\nline two changed\nline three\nline four\n")],
    );

    expect(diff.changedFiles).toBe(1);
    expect(diff.totalAddedLines).toBe(1);
    expect(diff.totalRemovedLines).toBe(1);
    expect(diff.text).toContain("-line two");
    expect(diff.text).toContain("+line two changed");
    expect(diff.text).toContain(" line one");
    expect(diff.text).toContain(" line four");
  });

  it("treats CRLF and LF starting files as equal", () => {
    const diff = buildProducedDiff(
      [starting("src/a.ts", "export const a = 1;\r\nexport const b = 2;\r\n")],
      [produced("src/a.ts", "export const a = 1;\nexport const b = 2;\n")],
    );

    expect(diff.changedFiles).toBe(0);
    expect(diff.text).toBe("");
  });

  it("is deterministic across input order", () => {
    const before = [starting("b.ts", "b\n"), starting("a.ts", "a\n")];
    const after = [produced("b.ts", "b2\n"), produced("a.ts", "a2\n"), produced("c.ts", "c\n")];

    const forward = buildProducedDiff(before, after);
    const reversed = buildProducedDiff([...before].reverse(), [...after].reverse());

    expect(reversed.text).toBe(forward.text);
    expect(reversed.files).toEqual(forward.files);
  });

  it("counts files and lines in the summary", () => {
    const diff = buildProducedDiff(
      [starting("keep.ts", "same\n"), starting("changed.ts", "old\n")],
      [
        produced("keep.ts", "same\n"),
        produced("changed.ts", "new\n"),
        produced("added.ts", "one\ntwo\n"),
      ],
    );

    expect(diff.files.map((file) => [file.path, file.status])).toEqual([
      ["changed.ts", "changed"],
      ["added.ts", "added"],
    ]);
    expect(diff.addedFiles).toBe(1);
    expect(diff.changedFiles).toBe(1);
    expect(diff.totalAddedLines).toBe(3);
    expect(diff.totalRemovedLines).toBe(1);
  });

  it("truncates when the byte budget is exhausted", () => {
    const diff = buildProducedDiff(
      [],
      [
        produced("a.ts", `${"a".repeat(200)}\n`),
        produced("b.ts", `${"b".repeat(200)}\n`),
        produced("c.ts", `${"c".repeat(200)}\n`),
      ],
      { maxBytes: 400 },
    );

    expect(diff.truncated).toBe(true);
    expect(diff.files.length).toBeLessThan(3);
    expect(diff.text.length).toBeLessThanOrEqual(400);
    expect(diff.addedFiles).toBe(3);
  });

  it("caps the number of diffed files", () => {
    const diff = buildProducedDiff(
      [],
      Array.from({ length: 5 }, (_unused, index) => produced(`f${index}.ts`, "x\n")),
      { maxFiles: 2 },
    );

    expect(diff.files).toHaveLength(2);
    expect(diff.truncated).toBe(true);
    expect(diff.addedFiles).toBe(5);
  });

  it("caps lines per file", () => {
    const body = Array.from({ length: 50 }, (_unused, index) => `line ${index}`).join("\n");
    const diff = buildProducedDiff([], [produced("big.ts", `${body}\n`)], {
      maxLinesPerFile: 10,
    });

    expect(diff.truncated).toBe(true);
    expect(
      diff.text
        .split("\n")
        .filter((line) => line.startsWith("+") && !line.startsWith("+++")).length,
    ).toBe(10);
  });

  it("respects the published default budgets", () => {
    expect(DIFF_DEFAULTS.maxBytes).toBe(262_144);
    expect(DIFF_DEFAULTS.maxFiles).toBeGreaterThan(50);
  });
});
