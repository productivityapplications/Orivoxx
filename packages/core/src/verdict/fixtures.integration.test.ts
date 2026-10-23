import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  classifyPathExclusion,
  detectLanguage,
  type NormalizedFile,
} from "../archive/index";
import {
  FixtureManifestSchema,
  type FixtureManifest,
  type VerificationReport,
} from "../contracts";
import { verifyDeterministic } from "../report/index";
import { parseSpec } from "../spec-parser/index";

type FixtureName = "taskboard-regressed" | "taskboard-compliant";

const fixturesRoot = fileURLToPath(new URL("../fixtures", import.meta.url));
const fixedTimestamp = new Date("2026-10-21T14:30:25.123Z");

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}

function countLines(content: string): number {
  if (content.length === 0) {
    return 0;
  }

  return content.endsWith("\n")
    ? content.split("\n").length - 1
    : content.split("\n").length;
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

interface LoadedFixture {
  specText: string;
  files: NormalizedFile[];
  manifest: FixtureManifest;
}

// Test-only fixture loader. Production Phase 3 modules never read from disk.
function loadFixture(fixture: FixtureName): LoadedFixture {
  const directory = join(fixturesRoot, fixture);
  const specText = readFileSync(join(directory, "PROJECT_SPEC.md"), "utf8").replace(
    /\r\n?/g,
    "\n",
  );
  const files: NormalizedFile[] = [];

  for (const absolutePath of listFiles(directory)) {
    const relativePath = absolutePath
      .slice(directory.length + 1)
      .replace(/\\/g, "/");

    if (classifyPathExclusion(relativePath) !== null) {
      continue;
    }

    const content = readFileSync(absolutePath, "utf8").replace(/\r\n?/g, "\n");
    files.push({
      path: relativePath,
      bytes: new TextEncoder().encode(content),
      content,
      lineCount: countLines(content),
      fingerprint: sha256(content),
      language: detectLanguage(relativePath),
      redacted: false,
    });
  }

  files.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));

  const manifest = FixtureManifestSchema.parse(
    JSON.parse(readFileSync(join(directory, "fixture.manifest.json"), "utf8")),
  );

  return { specText, files, manifest };
}

function statusOf(
  report: VerificationReport,
  requirementId: string,
): string | undefined {
  return report.requirements.find(
    (result) => result.requirementId === requirementId,
  )?.status;
}

describe("Phase 3 deterministic fixture integration", () => {
  it("matches taskboard-regressed exactly", () => {
    const { specText, files, manifest } = loadFixture("taskboard-regressed");
    const parsed = parseSpec(specText);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const report = verifyDeterministic({
      projectName: "taskboard-regressed",
      specText,
      files,
      now: fixedTimestamp,
    });
    const statuses = Object.fromEntries(
      report.requirements.map((result) => [result.requirementId, result.status]),
    );

    expect(statusOf(report, "REQ-AUTH-001")).toBe("FAIL");
    expect(statusOf(report, "REQ-ERR-001")).toBe("FAIL");
    expect(statusOf(report, "REQ-PATH-001")).toBe("PASS");
    expect(statusOf(report, "REQ-DEP-001")).toBe("PASS");
    expect(report.gate).toBe("BLOCKED");
    expect(report.runState).toBe("COMPLETE");
    expect(statuses).toEqual(manifest.expectedRequirementStatuses);
    expect(report.gate).toBe(manifest.expectedGate);
    expect(report.runState).toBe(manifest.expectedRunState);
    expect(report.model.called).toBe(false);
  });

  it("keeps the semantic requirement UNVERIFIED without an assessment", () => {
    // Phase 3 is deterministic-only. For a semantic requirement
    // with a passing text check but no model assessment, R5
    // produces UNVERIFIED. The manifest's expectedGate: PASS
    // and expectedRunState: COMPLETE are only reachable once
    // Phase 4 supplies a valid PASS assessment. Phase 4 will
    // extend this test to prove the full-run outcome.
    const { specText, files, manifest } = loadFixture("taskboard-compliant");
    const parsed = parseSpec(specText);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const report = verifyDeterministic({
      projectName: "taskboard-compliant",
      specText,
      files,
      now: fixedTimestamp,
    });

    expect(statusOf(report, "REQ-AUTH-001")).toBe("UNVERIFIED");
    expect(statusOf(report, "REQ-ERR-001")).toBe("PASS");
    expect(statusOf(report, "REQ-PATH-001")).toBe("PASS");
    expect(statusOf(report, "REQ-DEP-001")).toBe("PASS");
    expect(report.gate).toBe("BLOCKED");
    expect(report.runState).toBe("PARTIAL");
    expect(report.model.called).toBe(false);

    expect(manifest.expectedRequirementStatuses["REQ-AUTH-001"]).toBe("PASS");
    expect(manifest.expectedGate).toBe("PASS");
    expect(manifest.expectedRunState).toBe("COMPLETE");

    const authFinding = report.findings.find(
      (finding) => finding.requirementId === "REQ-AUTH-001",
    );

    expect(authFinding?.status).toBe("UNVERIFIED");
    expect(authFinding?.path).toBe("src/app/api/projects/[id]/route.ts");
  });
});
