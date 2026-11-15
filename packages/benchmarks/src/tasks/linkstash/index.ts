import type { ProjectFile } from "@orivoxx/core";

import type { TaskDefinition, TaskManifest } from "../../contracts/task.js";
import { SCORING_CONFIG_1_0_0 } from "../../scoring/config.js";
import { buildTaskDefinition } from "../build.js";
import {
  LINKSTASH_COMPLIANT_FILES,
  LINKSTASH_REGRESSED_FILES,
  LINKSTASH_SPEC_TEXT,
  LINKSTASH_STARTING_FILES,
} from "./generated.js";

export const LINKSTASH_MANIFEST: TaskManifest = {
  schemaVersion: "1.0.0",
  id: "linkstash",
  version: "1.0.0",
  title: "Linkstash: authenticated bookmark API",
  summary:
    "Build a bookmark API for a small authenticated product. Resolve the user, validate input with Zod, return structured errors, and avoid dynamic evaluation and shell-execution dependencies.",
  difficulty: "intermediate",
  tags: ["nextjs", "api", "validation", "security"],
  specPath: "PROJECT_SPEC.md",
  rulesetVersion: "1.0.0",
  scoringConfigVersion: "1.0.0",
  timeLimitSeconds: 900,
  maxSteps: 40,
  maxOutputBytes: 1_048_576,
  network: "model-proxy",
  startingFiles: LINKSTASH_STARTING_FILES,
  requirementBenches: {
    "REQ-API-001": "spec",
    "REQ-API-002": "spec",
    "REQ-API-003": "spec",
    "REQ-AUTH-001": "spec",
    "REQ-VALID-001": "spec",
    "REQ-ERR-001": "spec",
    "REQ-DB-001": "spec",
    "REQ-UI-001": "spec",
    "REQ-SEC-001": "security",
    "REQ-SEC-002": "security",
    "REQ-SEC-003": "security",
    "REQ-DEP-001": "spec",
  },
};

export const LINKSTASH_TASK: TaskDefinition = buildTaskDefinition({
  manifest: LINKSTASH_MANIFEST,
  specText: LINKSTASH_SPEC_TEXT,
  scoringConfig: SCORING_CONFIG_1_0_0,
});

interface TaskFixtureSet {
  compliant: readonly ProjectFile[];
  regressed: readonly ProjectFile[];
}

export const LINKSTASH_FIXTURES: TaskFixtureSet = {
  compliant: LINKSTASH_COMPLIANT_FILES,
  regressed: LINKSTASH_REGRESSED_FILES,
};
