import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { NormalizedFile } from "../archive/types";
import { extractDeclaredDependencies } from "./dependencies";

function makeFile(path: string, content: string): NormalizedFile {
  const normalized = content.replace(/\r\n?/g, "\n");

  return {
    path,
    bytes: new TextEncoder().encode(normalized),
    content: normalized,
    lineCount: normalized.length === 0 ? 0 : normalized.split("\n").length,
    fingerprint: createHash("sha256").update(normalized, "utf8").digest("hex"),
    language: path.endsWith(".json") ? "json" : "plaintext",
    redacted: false,
  };
}

describe("extractDeclaredDependencies", () => {
  it("merges dependencies, devDependencies and peerDependencies", () => {
    const files = [
      makeFile(
        "package.json",
        JSON.stringify({
          dependencies: { next: "^16", react: "^19" },
          devDependencies: { vitest: "^5" },
          peerDependencies: { zod: "^4" },
        }),
      ),
    ];

    expect(extractDeclaredDependencies(files)).toEqual([
      "next",
      "react",
      "vitest",
      "zod",
    ]);
  });

  it("returns an empty list when package.json is absent", () => {
    expect(extractDeclaredDependencies([])).toEqual([]);
  });

  it("returns an empty list when package.json is invalid JSON", () => {
    expect(
      extractDeclaredDependencies([makeFile("package.json", "{not json")]),
    ).toEqual([]);
  });

  it("ignores a nested package.json", () => {
    expect(
      extractDeclaredDependencies([
        makeFile("packages/example/package.json", '{"dependencies":{"a":"1"}}'),
      ]),
    ).toEqual([]);
  });

  it("returns only direct declarations, never transitive dependencies", () => {
    expect(
      extractDeclaredDependencies([
        makeFile(
          "package.json",
          '{"dependencies":{"a":"1"},"devDependencies":{"b":"1"}}',
        ),
      ]),
    ).toEqual(["a", "b"]);
  });

  it("ignores malformed dependency sections", () => {
    expect(
      extractDeclaredDependencies([
        makeFile(
          "package.json",
          '{"dependencies":"not-an-object","devDependencies":["a"]}',
        ),
      ]),
    ).toEqual([]);
  });
});
