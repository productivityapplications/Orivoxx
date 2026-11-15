import { describe, expect, it } from "vitest";

import type { NormalizedFile } from "@orivoxx/core";

import { SCORING_CONFIG_1_0_0 } from "./config.js";
import {
  analyzeStructure,
  computeStructuralMetrics,
  isEntrypointPath,
  resolveInternalImport,
  scoreStructuralMetrics,
} from "./structural.js";

function file(path: string, content: string): NormalizedFile {
  const bytes = new TextEncoder().encode(content);

  return {
    path,
    bytes,
    content,
    lineCount: content.split("\n").length,
    fingerprint: "f".repeat(64),
    language: "typescript",
    redacted: false,
  };
}

describe("structural analysis", () => {
  it("resolves relative imports with extension and index variants", () => {
    const modules = new Set([
      "src/lib/a.ts",
      "src/lib/b.tsx",
      "src/lib/c/index.ts",
    ]);

    expect(resolveInternalImport("src/lib/a", modules)).toBe("src/lib/a.ts");
    expect(resolveInternalImport("src/lib/b.js", modules)).toBe("src/lib/b.tsx");
    expect(resolveInternalImport("src/lib/c", modules)).toBe("src/lib/c/index.ts");
    expect(resolveInternalImport("src/lib/missing", modules)).toBeNull();
    expect(resolveInternalImport("../escape", modules)).toBeNull();
  });

  it("counts modules, edges, cycles, fan-out, and orphans", () => {
    const files = [
      file("src/app/page.tsx", 'import { a } from "../lib/a";\n'),
      file("src/lib/a.ts", 'import { b } from "./b";\n'),
      file("src/lib/b.ts", 'import { a } from "./a";\n'),
      file("src/lib/orphan.ts", "export const orphan = 1;\n"),
      file("src/lib/a.test.ts", 'import { a } from "./a";\n'),
    ];
    const analysis = analyzeStructure(files);

    expect(analysis.metrics).toEqual({
      moduleCount: 4,
      importEdges: 3,
      dependencyCycles: 1,
      maxFanOut: 1,
      orphanModules: 1,
      orphanRatio: 0.25,
    });
    expect(analysis.edges).toEqual([
      { from: "src/app/page.tsx", to: "src/lib/a.ts" },
      { from: "src/lib/a.ts", to: "src/lib/b.ts" },
      { from: "src/lib/b.ts", to: "src/lib/a.ts" },
    ]);
  });

  it("warns about an unresolved relative import", () => {
    const analysis = analyzeStructure([
      file("src/lib/x.ts", 'import { missing } from "./missing";\n'),
    ]);

    expect(analysis.warnings).toContain(
      "unresolved_import: src/lib/x.ts -> src/lib/missing",
    );
    expect(analysis.metrics.importEdges).toBe(0);
  });

  it("excludes test and mock files from the module graph", () => {
    const metrics = computeStructuralMetrics([
      file("src/lib/a.ts", "export const a = 1;\n"),
      file("src/lib/a.test.ts", 'import { a } from "./a";\n'),
      file("src/__tests__/a.ts", 'import { a } from "../lib/a";\n'),
    ]);

    expect(metrics.moduleCount).toBe(1);
    expect(metrics.importEdges).toBe(0);
  });

  it("recognizes framework entrypoints", () => {
    expect(isEntrypointPath("src/app/page.tsx")).toBe(true);
    expect(isEntrypointPath("src/app/api/projects/[id]/route.ts")).toBe(true);
    expect(isEntrypointPath("app/layout.tsx")).toBe(true);
    expect(isEntrypointPath("src/pages/index.tsx")).toBe(true);
    expect(isEntrypointPath("src/middleware.ts")).toBe(true);
    expect(isEntrypointPath("src/components/TaskList.tsx")).toBe(false);
    expect(isEntrypointPath("src/lib/db.ts")).toBe(false);
  });
});

describe("structural scoring", () => {
  const thresholds = SCORING_CONFIG_1_0_0.structural;

  it("awards 100 at every published good threshold", () => {
    const result = scoreStructuralMetrics(
      {
        moduleCount: 3,
        importEdges: 0,
        dependencyCycles: 0,
        maxFanOut: 8,
        orphanModules: 0,
        orphanRatio: 0.1,
      },
      thresholds,
    );

    expect(result.score).toBe(100);
    expect(result.metricScores).toEqual({
      cycles: 100,
      maxFanOut: 100,
      orphanRatio: 100,
      moduleCount: 100,
    });
  });

  it("degrades to 70 at the warn thresholds", () => {
    const result = scoreStructuralMetrics(
      {
        moduleCount: 60,
        importEdges: 0,
        dependencyCycles: 1,
        maxFanOut: 12,
        orphanModules: 15,
        orphanRatio: 0.25,
      },
      thresholds,
    );

    expect(result.metricScores).toEqual({
      cycles: 70,
      maxFanOut: 70,
      orphanRatio: 70,
      moduleCount: 100,
    });
    expect(result.score).toBe(77.5);
  });

  it("continues to degrade past the warn threshold", () => {
    const result = scoreStructuralMetrics(
      {
        moduleCount: 120,
        importEdges: 0,
        dependencyCycles: 2,
        maxFanOut: 24,
        orphanModules: 60,
        orphanRatio: 0.5,
      },
      thresholds,
    );

    expect(result.metricScores).toEqual({
      cycles: 40,
      maxFanOut: 40,
      orphanRatio: 40,
      moduleCount: 60,
    });
    expect(result.score).toBe(45);
  });

  it("penalizes a repository that is too small to maintain", () => {
    const result = scoreStructuralMetrics(
      {
        moduleCount: 0,
        importEdges: 0,
        dependencyCycles: 0,
        maxFanOut: 0,
        orphanModules: 0,
        orphanRatio: 0,
      },
      thresholds,
    );

    expect(result.metricScores.moduleCount).toBe(60);
    expect(result.score).toBe(90);
  });
});
