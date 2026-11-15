import { posix } from "node:path";

import { parseStaticReferences, type NormalizedFile } from "@orivoxx/core";

import type {
  StructuralMetricScores,
  StructuralMetrics,
  StructuralScore,
} from "../contracts/score.js";
import type { StructuralThresholds } from "../contracts/scoring.js";
import { clampScore, round1, round3 } from "./round.js";

const SCRIPT_PATH_PATTERN = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/i;
const TEST_PATH_PATTERN =
  /(?:^|\/)(?:__tests__|__mocks__)\/|\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|cjs)$/i;
const MODULE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"] as const;
const APP_ENTRYPOINT_PATTERN =
  /^(?:src\/)?app\/(?:.*\/)?(?:page|layout|route|loading|error|global-error|not-found|template|default)\.(?:tsx?|jsx?|mjs|cjs)$/;
const ROOT_ENTRYPOINTS = new Set([
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "src/middleware.ts",
  "src/middleware.js",
  "src/instrumentation.ts",
  "src/instrumentation.js",
  "src/index.ts",
  "src/index.tsx",
  "src/main.ts",
  "src/main.tsx",
]);

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function isModulePath(path: string): boolean {
  return SCRIPT_PATH_PATTERN.test(path) && !TEST_PATH_PATTERN.test(path);
}

export function isEntrypointPath(path: string): boolean {
  if (APP_ENTRYPOINT_PATTERN.test(path) || ROOT_ENTRYPOINTS.has(path)) {
    return true;
  }

  return /^(?:src\/)?pages\/.+\.(?:tsx?|jsx?|mjs|cjs)$/.test(path);
}

function addExtensionVariants(candidate: string, output: Set<string>): void {
  output.add(candidate);

  if (candidate.endsWith(".js")) {
    output.add(`${candidate.slice(0, -3)}.ts`);
    output.add(`${candidate.slice(0, -3)}.tsx`);
  }

  if (candidate.endsWith(".jsx")) {
    output.add(`${candidate.slice(0, -4)}.tsx`);
    output.add(`${candidate.slice(0, -4)}.ts`);
  }

  if (candidate.endsWith(".mjs") || candidate.endsWith(".cjs")) {
    const withoutExtension = candidate.slice(0, candidate.lastIndexOf("."));
    output.add(`${withoutExtension}.ts`);
    output.add(`${withoutExtension}.tsx`);
  }

  for (const extension of MODULE_EXTENSIONS) {
    output.add(`${candidate}${extension}`);
  }

  for (const extension of MODULE_EXTENSIONS) {
    output.add(`${candidate}/index${extension}`);
  }
}

export function resolveInternalImport(
  reference: string,
  modulePaths: ReadonlySet<string>,
): string | null {
  const normalized = posix
    .normalize(reference)
    .replace(/\/+$/g, "");

  if (
    normalized.length === 0 ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.startsWith("/")
  ) {
    return null;
  }

  const candidates = new Set<string>();
  addExtensionVariants(normalized, candidates);

  for (const candidate of [...candidates].sort(compareStrings)) {
    if (modulePaths.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function stronglyConnectedComponents(
  modules: readonly string[],
  edges: ReadonlyMap<string, ReadonlySet<string>>,
): string[][] {
  let nextIndex = 0;
  const index = new Map<string, number>();
  const lowLink = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];

  function visit(node: string): void {
    index.set(node, nextIndex);
    lowLink.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);

    const targets = [...(edges.get(node) ?? [])].sort(compareStrings);

    for (const target of targets) {
      if (!index.has(target)) {
        visit(target);
        lowLink.set(
          node,
          Math.min(lowLink.get(node) ?? 0, lowLink.get(target) ?? 0),
        );
      } else if (onStack.has(target)) {
        lowLink.set(
          node,
          Math.min(lowLink.get(node) ?? 0, index.get(target) ?? 0),
        );
      }
    }

    if (lowLink.get(node) !== index.get(node)) {
      return;
    }

    const component: string[] = [];
    let member: string | undefined;

    do {
      member = stack.pop();

      if (member === undefined) {
        break;
      }

      onStack.delete(member);
      component.push(member);
    } while (member !== node);

    components.push(component.sort(compareStrings));
  }

  for (const modulePath of [...modules].sort(compareStrings)) {
    if (!index.has(modulePath)) {
      visit(modulePath);
    }
  }

  return components;
}

export interface StructuralAnalysis {
  metrics: StructuralMetrics;
  warnings: string[];
  edges: { from: string; to: string }[];
}

export function analyzeStructure(files: readonly NormalizedFile[]): StructuralAnalysis {
  const modules = files
    .map((file) => file.path)
    .filter(isModulePath)
    .sort(compareStrings);
  const modulePaths = new Set(modules);
  const contents = new Map(files.map((file) => [file.path, file.content] as const));
  const edges = new Map<string, Set<string>>();
  const warnings = new Set<string>();
  let edgeCount = 0;

  for (const modulePath of modules) {
    const content = contents.get(modulePath) ?? "";
    const parsed = parseStaticReferences({
      path: modulePath,
      bytes: new TextEncoder().encode(content),
      content,
      lineCount: 0,
      fingerprint: "",
      language: "typescript",
      redacted: false,
    });

    if (!parsed.ok) {
      if (parsed.reason === "parse_error") {
        warnings.add(`parse_error: ${modulePath}`);
      }

      edges.set(modulePath, new Set<string>());
      continue;
    }

    const targets = new Set<string>();

    for (const reference of parsed.references) {
      const resolved = resolveInternalImport(reference.path, modulePaths);

      if (resolved === null) {
        warnings.add(`unresolved_import: ${modulePath} -> ${reference.path}`);
        continue;
      }

      targets.add(resolved);
    }

    edges.set(modulePath, targets);
    edgeCount += targets.size;
  }

  const components = stronglyConnectedComponents(modules, edges);
  let dependencyCycles = 0;

  for (const component of components) {
    if (component.length > 1) {
      dependencyCycles += 1;
      continue;
    }

    const only = component[0];

    if (only !== undefined && edges.get(only)?.has(only) === true) {
      dependencyCycles += 1;
    }
  }

  const inDegree = new Map<string, number>(modules.map((path) => [path, 0]));
  const edgeList: { from: string; to: string }[] = [];

  for (const from of modules) {
    for (const to of [...(edges.get(from) ?? [])].sort(compareStrings)) {
      inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
      edgeList.push({ from, to });
    }
  }

  const orphanModules = modules.filter(
    (path) => (inDegree.get(path) ?? 0) === 0 && !isEntrypointPath(path),
  ).length;
  const maxFanOut = modules.reduce(
    (maximum, path) => Math.max(maximum, edges.get(path)?.size ?? 0),
    0,
  );
  const orphanRatio = modules.length === 0 ? 0 : round3(orphanModules / modules.length);

  return {
    metrics: {
      moduleCount: modules.length,
      importEdges: edgeCount,
      dependencyCycles,
      maxFanOut,
      orphanModules,
      orphanRatio,
    },
    warnings: [...warnings].sort(compareStrings),
    edges: edgeList,
  };
}

export function computeStructuralMetrics(files: readonly NormalizedFile[]): StructuralMetrics {
  return analyzeStructure(files).metrics;
}

function degrade(value: number, good: number, warn: number): number {
  if (value <= good) {
    return 100;
  }

  if (value <= warn) {
    return round1(
      100 - (30 * (value - good)) / Math.max(warn - good, Number.EPSILON),
    );
  }

  return round1(
    clampScore(70 - (30 * (value - warn)) / Math.max(warn, Number.EPSILON)),
  );
}

function scoreModuleCount(value: number, min: number, max: number): number {
  if (value >= min && value <= max) {
    return 100;
  }

  if (value < min) {
    return round1(clampScore(100 - (40 * (min - value)) / min));
  }

  return round1(clampScore(100 - (40 * (value - max)) / max));
}

export function scoreStructuralMetrics(
  metrics: StructuralMetrics,
  thresholds: StructuralThresholds,
  warnings: readonly string[] = [],
): StructuralScore {
  const metricScores: StructuralMetricScores = {
    cycles: degrade(metrics.dependencyCycles, thresholds.cycles.good, thresholds.cycles.warn),
    maxFanOut: degrade(metrics.maxFanOut, thresholds.maxFanOut.good, thresholds.maxFanOut.warn),
    orphanRatio: degrade(
      metrics.orphanRatio,
      thresholds.orphanRatio.good,
      thresholds.orphanRatio.warn,
    ),
    moduleCount: scoreModuleCount(
      metrics.moduleCount,
      thresholds.moduleCount.min,
      thresholds.moduleCount.max,
    ),
  };
  const score = round1(
    (metricScores.cycles +
      metricScores.maxFanOut +
      metricScores.orphanRatio +
      metricScores.moduleCount) /
      4,
  );

  return {
    score,
    metrics,
    metricScores,
    warnings: warnings.slice(0, 100),
  };
}
