import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { FixtureManifestSchema } from "../contracts";

type FixtureName = "taskboard-regressed" | "taskboard-compliant";

const fixturesRoot = fileURLToPath(new URL(".", import.meta.url));
const fixtureNames: readonly FixtureName[] = ["taskboard-regressed", "taskboard-compliant"];
const requirementIds = ["REQ-AUTH-001", "REQ-ERR-001", "REQ-PATH-001", "REQ-DEP-001"];
const routeRelativePath = "src/app/api/projects/[id]/route.ts";

const expected = {
  "taskboard-regressed": {
    gate: "BLOCKED",
    statuses: {
      "REQ-AUTH-001": "FAIL",
      "REQ-ERR-001": "FAIL",
      "REQ-PATH-001": "PASS",
      "REQ-DEP-001": "PASS",
    },
  },
  "taskboard-compliant": {
    gate: "PASS",
    statuses: {
      "REQ-AUTH-001": "PASS",
      "REQ-ERR-001": "PASS",
      "REQ-PATH-001": "PASS",
      "REQ-DEP-001": "PASS",
    },
  },
} as const;

function fixturePath(fixture: FixtureName, relativePath: string): string {
  return join(fixturesRoot, fixture, relativePath);
}

function readFixture(fixture: FixtureName, relativePath: string): string {
  return readFileSync(fixturePath(fixture, relativePath), "utf8");
}

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}

describe.each(fixtureNames)("%s", (fixture) => {
  it("has PROJECT_SPEC.md with all required requirement IDs", () => {
    const spec = readFixture(fixture, "PROJECT_SPEC.md");
    expect(spec.length).toBeGreaterThan(0);

    for (const requirementId of requirementIds) {
      expect(spec).toContain(`### ${requirementId}`);
    }
  });

  it("declares REQ-AUTH-001 as critical and semantic", () => {
    const spec = readFixture(fixture, "PROJECT_SPEC.md");
    const authBlock = spec.slice(
      spec.indexOf("### REQ-AUTH-001"),
      spec.indexOf("### REQ-ERR-001"),
    );

    expect(authBlock).toMatch(/- Severity:\s*critical/);
    expect(authBlock).toMatch(/- Verification:\s*semantic/);
  });

  it("has the projects API route file", () => {
    expect(readFixture(fixture, routeRelativePath).length).toBeGreaterThan(0);
  });

  it("imports db from lib/db in the projects route", () => {
    expect(readFixture(fixture, routeRelativePath)).toMatch(/from\s+["'][^"']*lib\/db["']/);
  });

  it("declares next, react and react-dom without shelljs", () => {
    const pkg = JSON.parse(readFixture(fixture, "package.json")) as {
      dependencies?: Record<string, string>;
    };
    const dependencies = pkg.dependencies ?? {};

    expect(dependencies).not.toHaveProperty("shelljs");
    expect(Object.keys(dependencies).sort()).toEqual(["next", "react", "react-dom"]);
  });

  it("has a valid manifest with the expected gate and statuses", () => {
    const parsed = FixtureManifestSchema.safeParse(
      JSON.parse(readFixture(fixture, "fixture.manifest.json")),
    );

    expect(parsed.success).toBe(true);
    expect(parsed.data?.expectedRunState).toBe("COMPLETE");
    expect(parsed.data?.expectedGate).toBe(expected[fixture].gate);
    expect(parsed.data?.expectedRequirementStatuses).toEqual(expected[fixture].statuses);
  });

  it("has auth, session and db helpers plus graph-realistic clients", () => {
    const auth = readFixture(fixture, "src/lib/auth.ts");
    const session = readFixture(fixture, "src/lib/session.ts");
    const tasksRoute = readFixture(fixture, "src/app/api/tasks/route.ts");
    const taskList = readFixture(fixture, "src/components/TaskList.tsx");

    expect(auth).toContain("export async function assertProjectOwner");
    expect(auth).toContain('from "./session"');
    expect(auth).toContain("// Synthetic fixture: no real auth.");
    expect(session).toContain("export async function getSession");
    expect(tasksRoute).toMatch(/from\s+["'][^"']*lib\/db["']/);
    expect(taskList).toMatch(/from\s+["'][^"']*lib\/db["']/);
  });
});

describe("fixture code markers", () => {
  it("regressed route does not contain assertProjectOwner or catch (error)", () => {
    const route = readFixture("taskboard-regressed", routeRelativePath);

    expect(route).not.toContain("assertProjectOwner");
    expect(route).not.toContain("catch (error)");
  });

  it("compliant route contains assertProjectOwner and catch (error)", () => {
    const route = readFixture("taskboard-compliant", routeRelativePath);

    expect(route).toContain("assertProjectOwner");
    expect(route).toContain("catch (error)");
  });
});

describe("fixture safety", () => {
  it("uses an identical spec in both fixtures", () => {
    expect(readFixture("taskboard-regressed", "PROJECT_SPEC.md")).toBe(
      readFixture("taskboard-compliant", "PROJECT_SPEC.md"),
    );
  });

  it("contains no .env, *.pem or *.key files and no private-key markers", () => {
    const privateKeyMarker = ["BEGIN", "PRIVATE", "KEY"].join(" ");

    for (const fixture of fixtureNames) {
      for (const file of listFiles(fixturePath(fixture, ""))) {
        const name = basename(file);
        expect(name.startsWith(".env")).toBe(false);
        expect(name.endsWith(".pem")).toBe(false);
        expect(name.endsWith(".key")).toBe(false);
        expect(readFileSync(file, "utf8")).not.toContain(privateKeyMarker);
      }
    }
  });
});
