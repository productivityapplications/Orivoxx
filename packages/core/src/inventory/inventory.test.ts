import { describe, expect, it } from "vitest";

import type { NormalizedFile } from "../archive/types.js";
import { buildInventory } from "./inventory.js";

function makeFile(
  path: string,
  content: string,
  options: { language?: string; redacted?: boolean } = {},
): NormalizedFile {
  const bytes = new TextEncoder().encode(content);

  return {
    path,
    bytes,
    content,
    lineCount: content.length === 0 ? 0 : content.split("\n").length,
    fingerprint: `fingerprint-${path}`,
    language: options.language ?? "plaintext",
    redacted: options.redacted ?? false,
  };
}

describe("buildInventory", () => {
  it("builds file metadata and summary values", () => {
    const files = [
      makeFile("src/index.ts", "const a = 1;\n", { language: "typescript" }),
      makeFile("src/app.ts", "const b = 2;\nconst c = 3;\n", { language: "typescript" }),
      makeFile("README.md", "# Project\n", { language: "markdown" }),
    ];

    const result = buildInventory(files);

    expect(result.files).toEqual([
      {
        path: "src/index.ts",
        byteSize: 13,
        lineCount: 2,
        fingerprint: "fingerprint-src/index.ts",
        language: "typescript",
        redacted: false,
      },
      {
        path: "src/app.ts",
        byteSize: 26,
        lineCount: 3,
        fingerprint: "fingerprint-src/app.ts",
        language: "typescript",
        redacted: false,
      },
      {
        path: "README.md",
        byteSize: 10,
        lineCount: 2,
        fingerprint: "fingerprint-README.md",
        language: "markdown",
        redacted: false,
      },
    ]);
    expect(result.summary).toEqual({
      totalFiles: 3,
      totalBytes: 49,
      byLanguage: { typescript: 2, markdown: 1 },
      redactedCount: 0,
    });
    expect(result.warnings).toEqual([]);
  });

  it("counts languages and redacted files", () => {
    const files = [
      makeFile("a.ts", "const a = 1;\n", { language: "typescript", redacted: true }),
      makeFile("b.ts", "const b = 1;\n", { language: "typescript" }),
      makeFile("c.css", "body {}\n", { language: "css", redacted: true }),
    ];

    const result = buildInventory(files);

    expect(result.summary.byLanguage).toEqual({ typescript: 2, css: 1 });
    expect(result.summary.redactedCount).toBe(2);
  });

  it("returns an empty summary for empty input", () => {
    expect(buildInventory([])).toEqual({
      files: [],
      summary: {
        totalFiles: 0,
        totalBytes: 0,
        byLanguage: {},
        redactedCount: 0,
      },
      warnings: [],
    });
  });
});
