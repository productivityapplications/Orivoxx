import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SCORING_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(SCORING_DIR, "../..");

const ROOTS = [
  resolve(SCORING_DIR, "score.ts"),
  resolve(SCORING_DIR, "evaluate.ts"),
  resolve(SCORING_DIR, "structural.ts"),
  resolve(SCORING_DIR, "round.ts"),
];

const FORBIDDEN_PACKAGES = [
  "@orivoxx/harness",
  "apps/web",
  "nebius",
  "openai",
  "@anthropic-ai",
  "@google/generative-ai",
  "undici",
  "node:http",
  "node:https",
  "node:net",
  "node:dns",
  "node:child_process",
];

const IMPORT_PATTERN =
  /(?:from\s+|import\s+|import\s*\(\s*)["']([^"']+)["']/g;

function importsOf(source: string): string[] {
  const specifiers: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = IMPORT_PATTERN.exec(source)) !== null) {
    const specifier = match[1];

    if (specifier !== undefined) {
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

function resolveRelative(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const base = resolve(dirname(fromFile), specifier);
  const candidates = [base, `${base}.ts`, `${base}/index.ts`];

  if (base.endsWith(".js")) {
    candidates.unshift(`${base.slice(0, -3)}.ts`);
  }

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function collectGraph(roots: readonly string[]): {
  files: Set<string>;
  packages: Set<string>;
} {
  const files = new Set<string>();
  const packages = new Set<string>();
  const queue = [...roots];

  while (queue.length > 0) {
    const file = queue.pop();

    if (file === undefined || files.has(file)) {
      continue;
    }

    files.add(file);
    const source = readFileSync(file, "utf8");

    for (const specifier of importsOf(source)) {
      const resolved = resolveRelative(file, specifier);

      if (resolved !== null) {
        queue.push(resolved);
      } else {
        packages.add(specifier);
      }
    }
  }

  return { files, packages };
}

describe("deterministic scoring import graph", () => {
  const graph = collectGraph(ROOTS);

  it("reaches the scoring modules", () => {
    expect(graph.files.size).toBeGreaterThanOrEqual(ROOTS.length);
  });

  it("contains no provider, adapter, or network module", () => {
    for (const specifier of graph.packages) {
      for (const forbidden of FORBIDDEN_PACKAGES) {
        expect(specifier).not.toContain(forbidden);
      }
    }

    for (const file of graph.files) {
      expect(file.startsWith(PACKAGE_ROOT)).toBe(true);
      expect(file).not.toContain("packages/harness");
      expect(file).not.toContain("apps/web");
    }
  });

  it("contains no runtime side channel in the scoring source", () => {
    const forbiddenTokens = [
      "fetch(",
      "process.env",
      "Math.random",
      "Date.now",
      "new Date",
      "child_process",
    ];

    for (const file of graph.files) {
      const source = readFileSync(file, "utf8");

      for (const token of forbiddenTokens) {
        expect(source.includes(token), `${file} contains ${token}`).toBe(false);
      }
    }
  });

  it("only depends on deterministic packages", () => {
    const allowed = new Set(["@orivoxx/core", "node:path", "zod"]);

    for (const specifier of graph.packages) {
      expect(allowed.has(specifier), `unexpected dependency ${specifier}`).toBe(true);
    }
  });
});
