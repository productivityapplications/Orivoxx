import { describe, expect, it } from "vitest";

import { normalizeProjectFiles } from "../files.js";
import { scoreRealTask } from "./real-score.js";

const files = normalizeProjectFiles([
  { path: "index.js", content: "export const value = 1;\n" },
  { path: "package.json", content: '{"name":"x"}' },
  { path: "src/a.js", content: "import './b.js';\n" },
  { path: "src/b.js", content: "export const b = 1;\n" },
]);

const base = {
  taskId: "is-decimal-single-char",
  taskVersion: "1.0.0",
  adapterVersion: "1.0.0",
  repositoryFingerprint: "a".repeat(64),
  testExitCode: 0,
  files,
};

describe("real task scoring", () => {
  it("scores primary success as 100 and exposes quality benches", () => {
    const score = scoreRealTask({ ...base, testPassed: true });
    expect(score.overall).toBe(100);
    expect(score.benches.spec.score).toBe(100);
    expect(score.requirements.find((requirement) => requirement.id === "REQ-TEST-001")?.status).toBe("PASS");
    expect(score.benches.maintainability.score).toBeGreaterThan(0);
  });

  it("scores a failed test as 0 without fabricating a cap", () => {
    const score = scoreRealTask({ ...base, testPassed: false, testExitCode: 1 });
    expect(score.overall).toBe(0);
    expect(score.benches.spec.score).toBe(0);
    expect(score.requirements.find((requirement) => requirement.id === "REQ-TEST-001")?.status).toBe("FAIL");
    expect(score.capsApplied).toEqual([]);
  });

  it("flags a committed .env file and eval usage in the security bench", () => {
    const unsafe = normalizeProjectFiles([
      ...files.map((file) => ({ path: file.path, content: file.content })),
      { path: ".env", content: "SECRET=1\n" },
      { path: "src/eval.js", content: "eval('1');\n" },
    ]);
    const score = scoreRealTask({ ...base, testPassed: true, files: unsafe });
    expect(score.benches.security.score).toBeLessThan(100);
  });
});
