import type { ProjectFile } from "@orivoxx/core";

import type { TaskDefinition, TaskManifest } from "../../contracts/task.js";
import { SCORING_CONFIG_1_0_0 } from "../../scoring/config.js";
import { buildTaskDefinition } from "../build.js";
import {
  TASKBOARD_COMPLIANT_FILES,
  TASKBOARD_REGRESSED_FILES,
  TASKBOARD_SPEC_TEXT,
  TASKBOARD_STARTING_FILES,
} from "./generated.js";

export const TASKBOARD_MANIFEST: TaskManifest = {
  schemaVersion: "1.0.0",
  id: "taskboard",
  version: "1.0.0",
  title: "TaskBoard: owner-scoped project API",
  summary:
    "Build the project-access API for a small task board. Enforce ownership, return structured errors, read through the repository layer, and avoid shell-execution or dynamic-evaluation patterns.",
  difficulty: "starter",
  tags: ["nextjs", "api", "authorization", "security"],
  specPath: "PROJECT_SPEC.md",
  rulesetVersion: "1.0.0",
  scoringConfigVersion: "1.0.0",
  timeLimitSeconds: 900,
  maxSteps: 40,
  maxOutputBytes: 1_048_576,
  network: "model-proxy",
  startingFiles: TASKBOARD_STARTING_FILES,
  requirementBenches: {
    "REQ-AUTH-001": "spec",
    "REQ-ERR-001": "spec",
    "REQ-PATH-001": "spec",
    "REQ-DEP-001": "security",
    "REQ-TASKS-001": "spec",
    "REQ-TASKS-002": "spec",
    "REQ-UI-001": "spec",
    "REQ-SEC-002": "security",
    "REQ-SEC-003": "security",
  },
};

export const TASKBOARD_TASK: TaskDefinition = buildTaskDefinition({
  manifest: TASKBOARD_MANIFEST,
  specText: TASKBOARD_SPEC_TEXT,
  scoringConfig: SCORING_CONFIG_1_0_0,
});

interface TaskFixtureSet {
  compliant: readonly ProjectFile[];
  regressed: readonly ProjectFile[];
}

export const TASKBOARD_FIXTURES: TaskFixtureSet = {
  compliant: TASKBOARD_COMPLIANT_FILES,
  regressed: TASKBOARD_REGRESSED_FILES,
};
