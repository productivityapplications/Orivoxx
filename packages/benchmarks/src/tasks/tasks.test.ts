import { describe, expect, it } from "vitest";

import { parseSpec } from "@orivoxx/core";

import { SCORING_CONFIG_1_0_0 } from "../scoring/config.js";
import type { TaskManifest } from "../contracts/task.js";
import {
  buildTaskDefinition,
  TaskDefinitionError,
} from "./build.js";
import {
  getTask,
  listTasks,
  LINKSTASH_TASK,
  TASKBOARD_TASK,
} from "./index.js";
import { TaskNotFoundError, TaskRegistry, TaskRegistryError } from "./registry.js";

const BASE_MANIFEST: TaskManifest = {
  schemaVersion: "1.0.0",
  id: "test-task",
  version: "1.0.0",
  title: "Test task",
  summary: "A task used by unit tests.",
  difficulty: "starter",
  tags: ["test"],
  specPath: "PROJECT_SPEC.md",
  rulesetVersion: "1.0.0",
  scoringConfigVersion: "1.0.0",
  timeLimitSeconds: 120,
  maxSteps: 5,
  maxOutputBytes: 4096,
  network: "none",
  startingFiles: [{ path: "PROJECT_SPEC.md", content: "" }],
  requirementBenches: {},
};

function manifestWithSpec(specText: string, overrides: Partial<TaskManifest> = {}): TaskManifest {
  return {
    ...BASE_MANIFEST,
    ...overrides,
    startingFiles: [{ path: "PROJECT_SPEC.md", content: specText }],
  };
}

const DETERMINISTIC_SPEC = `# Test task

## Requirements

### REQ-TEST-001 — A file exists
- Severity: high
- Verification: deterministic
- Description: The package manifest must exist.
- Checks:
  - type: file_exists
    path: package.json
`;

describe("task registry", () => {
  it("lists both tasks with the featured task pinned", () => {
    const tasks = listTasks();

    expect(tasks.map((task) => task.id)).toEqual(["linkstash", "taskboard"]);
    expect(tasks.find((task) => task.id === "taskboard")?.pinned).toBe(true);
    expect(tasks.find((task) => task.id === "linkstash")?.pinned).toBe(false);
  });

  it("resolves a task by id and version", () => {
    expect(getTask("taskboard").manifest.version).toBe("1.0.0");
    expect(getTask("taskboard", "1.0.0").manifest.id).toBe("taskboard");
    expect(() => getTask("missing")).toThrow(TaskNotFoundError);
    expect(() => getTask("taskboard", "9.9.9")).toThrow(TaskNotFoundError);
  });

  it("rejects duplicate task definitions", () => {
    expect(() => new TaskRegistry([TASKBOARD_TASK, TASKBOARD_TASK])).toThrow(
      TaskRegistryError,
    );
  });

  it("rejects an empty registry", () => {
    expect(() => new TaskRegistry([])).toThrow(TaskRegistryError);
  });
});

describe("TaskBoard task", () => {
  it("derives the expected deterministic requirements", () => {
    const ids = TASKBOARD_TASK.ruleset.requirements.map((requirement) => requirement.id);

    expect(ids).toEqual([
      "REQ-AUTH-001",
      "REQ-DEP-001",
      "REQ-ERR-001",
      "REQ-PATH-001",
      "REQ-SEC-002",
      "REQ-SEC-003",
      "REQ-TASKS-001",
      "REQ-TASKS-002",
      "REQ-UI-001",
    ]);
    expect(TASKBOARD_TASK.ruleset.version).toBe("1.0.0");
    expect(TASKBOARD_TASK.scoringConfig.version).toBe("1.0.0");
  });

  it("uses only deterministic requirements", () => {
    const parsed = parseSpec(TASKBOARD_TASK.specText);

    expect(parsed.ok).toBe(true);

    if (!parsed.ok) {
      return;
    }

    expect(
      parsed.requirements.every(
        (requirement) => requirement.verificationMode === "deterministic",
      ),
    ).toBe(true);
  });

  it("keeps the starting spec identical to the task spec", () => {
    const spec = TASKBOARD_TASK.manifest.startingFiles.find(
      (file) => file.path === "PROJECT_SPEC.md",
    );

    expect(spec?.content).toBe(TASKBOARD_TASK.specText);
  });

  it("produces a stable ruleset fingerprint", () => {
    expect(TASKBOARD_TASK.ruleset.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(buildTaskDefinition({
      manifest: TASKBOARD_TASK.manifest,
      specText: TASKBOARD_TASK.specText,
      scoringConfig: TASKBOARD_TASK.scoringConfig,
    }).ruleset.fingerprint).toBe(TASKBOARD_TASK.ruleset.fingerprint);
  });
});

describe("Linkstash task", () => {
  it("has the expected requirement count and bench split", () => {
    const counts = { spec: 0, security: 0 };

    for (const requirement of LINKSTASH_TASK.ruleset.requirements) {
      counts[requirement.bench] += 1;
    }

    expect(LINKSTASH_TASK.ruleset.requirements).toHaveLength(12);
    expect(counts).toEqual({ spec: 9, security: 3 });
  });
});

describe("task definition validation", () => {
  it("rejects a semantic requirement", () => {
    const spec = `# Test task

## Requirements

### REQ-TEST-001 — A file exists
- Severity: high
- Verification: semantic
- Description: The package manifest must exist.
- Checks:
  - type: file_exists
    path: package.json
`;

    expect(() =>
      buildTaskDefinition({
        manifest: manifestWithSpec(spec, {
          requirementBenches: { "REQ-TEST-001": "spec" },
        }),
        specText: spec,
        scoringConfig: SCORING_CONFIG_1_0_0,
      }),
    ).toThrow(TaskDefinitionError);
  });

  it("rejects a requirement without a bench assignment", () => {
    expect(() =>
      buildTaskDefinition({
        manifest: manifestWithSpec(DETERMINISTIC_SPEC),
        specText: DETERMINISTIC_SPEC,
        scoringConfig: SCORING_CONFIG_1_0_0,
      }),
    ).toThrow(/no bench assignment/);
  });

  it("rejects a starting spec that differs from specText", () => {
    const manifest = {
      ...manifestWithSpec(DETERMINISTIC_SPEC, {
        requirementBenches: { "REQ-TEST-001": "spec" },
      }),
      startingFiles: [{ path: "PROJECT_SPEC.md", content: "different" }],
    };

    expect(() =>
      buildTaskDefinition({
        manifest,
        specText: DETERMINISTIC_SPEC,
        scoringConfig: SCORING_CONFIG_1_0_0,
      }),
    ).toThrow(/exact specText/);
  });
});

describe("scoring configuration", () => {
  it("uses weights that sum to one", () => {
    const weights = SCORING_CONFIG_1_0_0.benchWeights;

    expect(weights.spec + weights.security + weights.maintainability).toBeCloseTo(1, 10);
  });

  it("records the expected severity order", () => {
    const weights = SCORING_CONFIG_1_0_0.severityWeights;

    expect(weights.critical).toBeGreaterThan(weights.high);
    expect(weights.high).toBeGreaterThan(weights.medium);
    expect(weights.medium).toBeGreaterThan(weights.low);
  });
});
