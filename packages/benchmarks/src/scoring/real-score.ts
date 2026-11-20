import type { NormalizedFile } from "@orivoxx/core";

import type { ScoreResult } from "../contracts/score.js";
import type { ScoringConfig } from "../contracts/scoring.js";
import { analyzeStructure, scoreStructuralMetrics } from "./structural.js";

export const REAL_TASK_SCORING_CONFIG = {
  schemaVersion: "1.0.0",
  version: "1.0.0",
  benchWeights: { spec: 0.6, security: 0.25, maintainability: 0.15 },
  severityWeights: { critical: 8, high: 4, medium: 2, low: 1 },
  caps: { criticalSpec: 59.9, criticalSecurity: 49.9 },
  structural: {
    cycles: { good: 0, warn: 1 },
    maxFanOut: { good: 8, warn: 12 },
    orphanRatio: { good: 0.1, warn: 0.25 },
    moduleCount: { min: 3, max: 60 },
  },
} as const satisfies ScoringConfig;

export interface RealTaskScoreInput {
  taskId: string;
  taskVersion: string;
  adapterVersion: string;
  repositoryFingerprint: string;
  testPassed: boolean;
  testExitCode: number;
  files: readonly NormalizedFile[];
}

/**
 * Primary success for a real repository task is the test command. The score is
 * 100 on exit 0 and 0 otherwise; security and maintainability remain published
 * quality flags, never a substitute for the test.
 */
export function scoreRealTask(input: RealTaskScoreInput): ScoreResult {
  const analysis = analyzeStructure(input.files);
  const structural = scoreStructuralMetrics(analysis.metrics, REAL_TASK_SCORING_CONFIG.structural, analysis.warnings);
  const text = input.files.map((file) => file.content).join("\n");
  const packageJson = input.files.find((file) => file.path === "package.json")?.content ?? "";

  const security = [
    {
      id: "REQ-SEC-ENV",
      present: !input.files.some((file) => /(^|\/)\.env(\.|$)/.test(file.path)),
      weight: 8,
    },
    { id: "REQ-SEC-EVAL", present: !/eval\s*\(/.test(text), weight: 8 },
    { id: "REQ-SEC-SHELL", present: !/shelljs/.test(packageJson), weight: 8 },
  ];
  const securityScore =
    (security.filter((item) => item.present).reduce((sum, item) => sum + item.weight, 0) /
      security.reduce((sum, item) => sum + item.weight, 0)) *
    100;

  const pass = input.testPassed;
  const requirements = [
    {
      id: "REQ-TEST-001",
      bench: "spec" as const,
      severity: "critical" as const,
      status: pass ? ("PASS" as const) : ("FAIL" as const),
      weight: 8,
      earned: pass ? 8 : 0,
    },
    ...security.map((item) => ({
      id: item.id,
      bench: "security" as const,
      severity: "critical" as const,
      status: item.present ? ("PASS" as const) : ("FAIL" as const),
      weight: item.weight,
      earned: item.present ? item.weight : 0,
    })),
  ];

  const specScore = pass ? 100 : 0;
  const overall = pass ? 100 : 0;

  return {
    schemaVersion: "1.0.0",
    taskId: input.taskId,
    taskVersion: input.taskVersion,
    rulesetVersion: "1.0.0",
    scoringConfigVersion: "1.0.0",
    adapterVersion: input.adapterVersion,
    repositoryFingerprint: input.repositoryFingerprint,
    overall,
    benches: {
      spec: {
        score: specScore,
        earnedWeight: pass ? 8 : 0,
        totalWeight: 8,
        passed: pass ? 1 : 0,
        failed: pass ? 0 : 1,
        drifted: 0,
        unverified: 0,
      },
      security: {
        score: securityScore,
        earnedWeight: security.filter((item) => item.present).reduce((sum, item) => sum + item.weight, 0),
        totalWeight: 24,
        passed: security.filter((item) => item.present).length,
        failed: security.filter((item) => !item.present).length,
        drifted: 0,
        unverified: 0,
      },
      maintainability: structural,
    },
    requirements,
    capsApplied: [],
    appliedCap: null,
    unverifiedRequirementIds: [],
  } as ScoreResult;
}
