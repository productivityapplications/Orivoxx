import { describe, expect, it } from "vitest";

import {
  buildCheckContext,
  computeSnapshotFingerprint,
  parseSpec,
  runChecks,
} from "@orivoxx/core";

import { normalizeProjectFiles, ProjectFileError } from "../files.js";
import {
  getTaskFixtures,
  LINKSTASH_TASK,
  TASKBOARD_TASK,
  type TaskFixtureVariant,
} from "./index.js";
import type { TaskDefinition } from "../contracts/task.js";

const EXPECTED: Record<
  string,
  Record<TaskFixtureVariant, Record<string, "PASS" | "FAIL">>
> = {
  taskboard: {
    compliant: {
      "REQ-AUTH-001": "PASS",
      "REQ-ERR-001": "PASS",
      "REQ-PATH-001": "PASS",
      "REQ-DEP-001": "PASS",
      "REQ-TASKS-001": "PASS",
      "REQ-TASKS-002": "PASS",
      "REQ-UI-001": "PASS",
      "REQ-SEC-002": "PASS",
      "REQ-SEC-003": "PASS",
    },
    regressed: {
      "REQ-AUTH-001": "FAIL",
      "REQ-ERR-001": "FAIL",
      "REQ-PATH-001": "PASS",
      "REQ-DEP-001": "PASS",
      "REQ-TASKS-001": "PASS",
      "REQ-TASKS-002": "PASS",
      "REQ-UI-001": "PASS",
      "REQ-SEC-002": "PASS",
      "REQ-SEC-003": "PASS",
    },
  },
  linkstash: {
    compliant: {
      "REQ-API-001": "PASS",
      "REQ-API-002": "PASS",
      "REQ-API-003": "PASS",
      "REQ-AUTH-001": "PASS",
      "REQ-VALID-001": "PASS",
      "REQ-ERR-001": "PASS",
      "REQ-DB-001": "PASS",
      "REQ-UI-001": "PASS",
      "REQ-SEC-001": "PASS",
      "REQ-SEC-002": "PASS",
      "REQ-SEC-003": "PASS",
      "REQ-DEP-001": "PASS",
    },
    regressed: {
      "REQ-API-001": "PASS",
      "REQ-API-002": "PASS",
      "REQ-API-003": "PASS",
      "REQ-AUTH-001": "FAIL",
      "REQ-VALID-001": "FAIL",
      "REQ-ERR-001": "FAIL",
      "REQ-DB-001": "PASS",
      "REQ-UI-001": "PASS",
      "REQ-SEC-001": "FAIL",
      "REQ-SEC-002": "PASS",
      "REQ-SEC-003": "FAIL",
      "REQ-DEP-001": "FAIL",
    },
  },
};

const TASKS: readonly TaskDefinition[] = [TASKBOARD_TASK, LINKSTASH_TASK];
const VARIANTS: readonly TaskFixtureVariant[] = ["compliant", "regressed"];

describe.each(TASKS)("$manifest.id fixtures", (task) => {
  const fixtures = getTaskFixtures(task.manifest.id);

  it("has fixture sets", () => {
    expect(fixtures).toBeDefined();
  });

  it.each(VARIANTS)("matches the expected deterministic statuses for %s", (variant) => {
    const fixture = fixtures?.[variant];

    expect(fixture).toBeDefined();

    const files = normalizeProjectFiles(fixture ?? []);
    const parsed = parseSpec(task.specText);

    expect(parsed.ok).toBe(true);

    if (!parsed.ok) {
      return;
    }

    const outcomes = runChecks(parsed.requirements, buildCheckContext(files));
    const statuses: Record<string, "PASS" | "FAIL"> = {};

    for (const requirement of parsed.requirements) {
      const outcome = outcomes.get(requirement.id);
      statuses[requirement.id] = outcome?.status ?? "FAIL";
    }

    expect(statuses).toEqual(EXPECTED[task.manifest.id]?.[variant]);
  });

  it("produces different repository fingerprints for the two variants", () => {
    const compliant = normalizeProjectFiles(fixtures?.compliant ?? []);
    const regressed = normalizeProjectFiles(fixtures?.regressed ?? []);

    expect(computeSnapshotFingerprint(task.specText, compliant)).not.toBe(
      computeSnapshotFingerprint(task.specText, regressed),
    );
  });
});

describe("project file normalization", () => {
  it("rejects traversal paths", () => {
    expect(() =>
      normalizeProjectFiles([{ path: "../escape.ts", content: "x" }]),
    ).toThrow(ProjectFileError);
  });

  it("rejects duplicate paths", () => {
    expect(() =>
      normalizeProjectFiles([
        { path: "src/a.ts", content: "a" },
        { path: "src/a.ts", content: "b" },
      ]),
    ).toThrow(ProjectFileError);
  });

  it("excludes secret-bearing paths", () => {
    const files = normalizeProjectFiles([
      { path: ".env", content: "SECRET=1" },
      { path: "src/a.ts", content: "export const a = 1;" },
    ]);

    expect(files.map((file) => file.path)).toEqual(["src/a.ts"]);
  });

  it("redacts secret values while keeping a stable fingerprint", () => {
    const files = normalizeProjectFiles([
      {
        path: "src/config.ts",
        content: 'export const key = "sk-or-v1-abcdefghijklmnopqrstuvwxyz0123456789";',
      },
    ]);

    expect(files[0]?.redacted).toBe(true);
    expect(files[0]?.content).not.toContain(
      "sk-or-v1-abcdefghijklmnopqrstuvwxyz0123456789",
    );
  });
});
