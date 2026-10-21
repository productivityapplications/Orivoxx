import { createHash } from "node:crypto";

import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { intakeArchive } from "./archive.js";
import {
  MAX_COMPRESSED_BYTES,
  MAX_ELIGIBLE_AGGREGATE_TEXT,
  MAX_ELIGIBLE_FILE_BYTES,
} from "./types.js";

const encoder = new TextEncoder();

function encode(value: string): Uint8Array {
  return encoder.encode(value);
}

function zipFiles(files: Record<string, Uint8Array | [Uint8Array, { level?: number; os?: number; attrs?: number }]>): Uint8Array {
  return zipSync(files);
}

function expectFailure(result: ReturnType<typeof intakeArchive>, code: string): void {
  expect(result.ok).toBe(false);

  if (!result.ok) {
    expect(result.error.code).toBe(code);
  }
}

describe("intakeArchive", () => {
  it("accepts a valid small ZIP with normalized content and metadata", () => {
    const zip = zipFiles({
      "PROJECT_SPEC.md": encode("# Project\n\n### REQ-ONE-001\n"),
      "src/index.ts": encode("const value = 1;\r\nconsole.log(value);\r\n"),
    });

    const result = intakeArchive(zip);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.files.map((file) => file.path)).toEqual(["PROJECT_SPEC.md", "src/index.ts"]);

    const source = result.files.find((file) => file.path === "src/index.ts");

    expect(source).toBeDefined();
    expect(source?.content).toBe("const value = 1;\nconsole.log(value);\n");
    expect(source?.language).toBe("typescript");
    expect(source?.lineCount).toBe(2);
    expect(source?.redacted).toBe(false);
    expect(source?.fingerprint).toBe(
      createHash("sha256").update("const value = 1;\nconsole.log(value);\n", "utf8").digest("hex"),
    );
    expect(result.warnings).toEqual([]);
  });

  it("redacts secrets in included file content", () => {
    const zip = zipFiles({
      "config.ts": encode('const token = "Bearer abcdefghijklmnopqrstuvwxyz";\n'),
    });

    const result = intakeArchive(zip);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.files[0]?.content).not.toContain("abcdefghijklmnopqrstuvwxyz");
    expect(result.files[0]?.content).toContain("[REDACTED:bearer_token]");
    expect(result.files[0]?.redacted).toBe(true);
  });

  it("rejects traversal paths", () => {
    const result = intakeArchive(zipFiles({ "../etc/passwd": encode("root:x:0:0") }));

    expectFailure(result, "traversal_path");
  });

  it("rejects absolute paths", () => {
    const result = intakeArchive(zipFiles({ "/etc/passwd": encode("root:x:0:0") }));

    expectFailure(result, "absolute_path");
  });

  it("rejects Windows drive paths", () => {
    const result = intakeArchive(zipFiles({ "C:\\Users\\person\\secret.ts": encode("x") }));

    expectFailure(result, "drive_path");
  });

  it("rejects NUL bytes in entry paths", () => {
    const result = intakeArchive(zipFiles({ "bad\0name.ts": encode("x") }));

    expectFailure(result, "nul_in_path");
  });

  it("rejects duplicate paths after normalization", () => {
    const result = intakeArchive(
      zipFiles({
        "a/b.ts": encode("first"),
        "a\\b.ts": encode("second"),
      }),
    );

    expectFailure(result, "duplicate_path");
  });

  it("rejects symlink entries", () => {
    const result = intakeArchive(
      zipSync({
        "src/link.ts": [new Uint8Array(0), { os: 3, attrs: 0o120777 << 16 }],
      }),
    );

    expectFailure(result, "symlink_entry");
  });

  it("excludes .env files with a warning but allows .env.example", () => {
    const result = intakeArchive(
      zipFiles({
        ".env": encode("SOME_VALUE=1"),
        ".env.example": encode("SOME_VALUE="),
      }),
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.files.map((file) => file.path)).toEqual([".env.example"]);
    expect(result.warnings).toContain("excluded: .env (reason: env_file)");
  });

  it("excludes node_modules paths with a warning", () => {
    const result = intakeArchive(
      zipFiles({
        "node_modules/pkg/index.ts": encode("export const value = 1;\n"),
        "src/index.ts": encode("export const value = 2;\n"),
      }),
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.files.map((file) => file.path)).toEqual(["src/index.ts"]);
    expect(result.warnings).toContain(
      "excluded: node_modules/pkg/index.ts (reason: excluded_directory)",
    );
  });

  it("rejects archives with more than 300 entries", () => {
    const entries = Object.fromEntries(
      Array.from({ length: 301 }, (_, index) => [`file-${index}.ts`, encode("x")]),
    );

    expectFailure(intakeArchive(zipFiles(entries)), "entry_count_exceeded");
  });

  it("rejects archives whose compressed size exceeds 3 MiB", () => {
    const data = new Uint8Array(MAX_COMPRESSED_BYTES + 1024);

    for (let index = 0; index < data.length; index += 1) {
      data[index] = (index * 31 + 7) % 256;
    }

    const zip = zipSync({ "large.bin.txt": [data, { level: 0 }] });

    expect(zip.byteLength).toBeGreaterThan(MAX_COMPRESSED_BYTES);
    expectFailure(intakeArchive(zip), "compressed_size_exceeded");
  });

  it("rejects archives whose eligible decompressed total exceeds 10 MiB", () => {
    const text = "A".repeat(280 * 1024);
    const entries = Object.fromEntries(
      Array.from({ length: 40 }, (_, index) => [`src/file-${index}.ts`, encode(text)]),
    );

    expectFailure(intakeArchive(zipFiles(entries)), "expanded_size_exceeded");
  }, 20_000);

  it("excludes a single eligible file over 300 KiB and keeps the archive", () => {
    const oversized = "A".repeat(MAX_ELIGIBLE_FILE_BYTES + 8192);
    const result = intakeArchive(
      zipFiles({
        "src/large.ts": encode(oversized),
        "src/small.ts": encode("export const small = true;\n"),
      }),
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.files.map((file) => file.path)).toEqual(["src/small.ts"]);
    expect(result.warnings).toContain(
      `excluded: src/large.ts (reason: oversized_eligible_file, bytes: ${oversized.length})`,
    );
  });

  it("trims the lexicographic prefix when aggregate text exceeds 2 MiB", () => {
    const text = "x".repeat(10 * 1024);
    const entries = Object.fromEntries(
      Array.from({ length: 300 }, (_, index) => [
        `src/file-${String(index).padStart(3, "0")}.ts`,
        encode(text),
      ]),
    );

    const result = intakeArchive(zipFiles(entries));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const aggregateBytes = result.files.reduce((total, file) => total + file.bytes.byteLength, 0);
    const aggregateWarnings = result.warnings.filter((warning) =>
      warning.includes("aggregate_text_exceeded"),
    );

    expect(result.files).toHaveLength(204);
    expect(aggregateBytes).toBeLessThanOrEqual(MAX_ELIGIBLE_AGGREGATE_TEXT);
    expect(aggregateWarnings).toHaveLength(96);
    expect(result.files[0]?.path).toBe("src/file-000.ts");
    expect(result.files[203]?.path).toBe("src/file-203.ts");
  }, 20_000);

  it("rejects an archive with no eligible text files", () => {
    const result = intakeArchive(
      zipFiles({
        "image.png": new Uint8Array([1, 2, 3]),
        "archive.zip": new Uint8Array([1, 2, 3]),
        "mystery.dat": new Uint8Array([0, 1, 2, 3]),
      }),
    );

    expectFailure(result, "no_eligible_files");
  });

  it("excludes files that fail strict UTF-8 decoding", () => {
    const result = intakeArchive(
      zipFiles({
        "broken.ts": new Uint8Array([0xff, 0xfe, 0xfd, 0xfc]),
        "valid.ts": encode("export const value = 1;\n"),
      }),
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.files.map((file) => file.path)).toEqual(["valid.ts"]);
    expect(result.warnings).toContain("excluded: broken.ts (reason: utf8_decode_failed)");
  });

  it("rejects invalid ZIP bytes", () => {
    expectFailure(intakeArchive(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])), "invalid_zip");
  });

  it("rejects an empty archive because it has no eligible files", () => {
    expectFailure(intakeArchive(zipSync({})), "no_eligible_files");
  });
});
