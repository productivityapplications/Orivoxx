import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { NormalizedFile } from "../archive/types";
import type { Check, Requirement } from "../contracts";
import { runCheck, runChecks } from "./checks";
import type { CheckContext } from "./types";

function countLines(content: string): number {
  if (content.length === 0) {
    return 0;
  }

  return content.endsWith("\n")
    ? content.split("\n").length - 1
    : content.split("\n").length;
}

function languageFor(path: string): string {
  if (path.endsWith(".json")) {
    return "json";
  }

  if (path.endsWith(".ts") || path.endsWith(".tsx")) {
    return "typescript";
  }

  return "plaintext";
}

function makeFile(path: string, content: string): NormalizedFile {
  const normalized = content.replace(/\r\n?/g, "\n");

  return {
    path,
    bytes: new TextEncoder().encode(normalized),
    content: normalized,
    lineCount: countLines(normalized),
    fingerprint: createHash("sha256").update(normalized, "utf8").digest("hex"),
    language: languageFor(path),
    redacted: false,
  };
}

function makeContext(files: NormalizedFile[], dependencies: string[] = []): CheckContext {
  return { files, dependencies };
}

describe("runCheck file_exists", () => {
  it("passes when the file is present", () => {
    const check: Check = { type: "file_exists", path: "src/a.ts" };
    const outcome = runCheck(check, makeContext([makeFile("src/a.ts", "export {};\n")]));

    expect(outcome.status).toBe("PASS");
    expect(outcome.evidence[0]?.type).toBe("file_presence");
    expect(outcome.evidence[0]?.summary).toBe("File exists at src/a.ts.");
  });

  it("fails when the file is absent", () => {
    const check: Check = { type: "file_exists", path: "src/a.ts" };
    const outcome = runCheck(check, makeContext([]));

    expect(outcome.status).toBe("FAIL");
    expect(outcome.evidence[0]?.type).toBe("file_absence");
    expect(outcome.evidence[0]?.summary).toBe(
      "File not present in the project snapshot.",
    );
  });
});

describe("runCheck file_absent", () => {
  it("passes when the file is absent", () => {
    const check: Check = { type: "file_absent", path: "src/a.ts" };
    const outcome = runCheck(check, makeContext([]));

    expect(outcome.status).toBe("PASS");
    expect(outcome.evidence[0]?.type).toBe("file_absence");
  });

  it("fails when the file is present", () => {
    const check: Check = { type: "file_absent", path: "src/a.ts" };
    const outcome = runCheck(
      check,
      makeContext([makeFile("src/a.ts", "export {};\n")]),
    );

    expect(outcome.status).toBe("FAIL");
    expect(outcome.evidence[0]?.type).toBe("file_presence");
  });
});

describe("runCheck text_contains", () => {
  const check: Check = {
    type: "text_contains",
    path: "src/a.ts",
    text: "needle",
  };

  it("passes and records the first occurrence line", () => {
    const outcome = runCheck(
      check,
      makeContext([makeFile("src/a.ts", "alpha\nbeta\nneedle here\n")]),
    );

    expect(outcome.status).toBe("PASS");
    expect(outcome.evidence[0]?.type).toBe("text_marker");
    expect(outcome.evidence[0]?.startLine).toBe(3);
  });

  it("fails when the substring is absent", () => {
    const outcome = runCheck(
      check,
      makeContext([makeFile("src/a.ts", "alpha\nbeta\n")]),
    );

    expect(outcome.status).toBe("FAIL");
    expect(outcome.evidence[0]?.summary).toBe("Required text marker not found.");
  });

  it("fails when the file is missing", () => {
    const outcome = runCheck(check, makeContext([]));

    expect(outcome.status).toBe("FAIL");
    expect(outcome.evidence[0]?.summary).toBe("Required text marker not found.");
  });
});

describe("runCheck text_not_contains", () => {
  const check: Check = {
    type: "text_not_contains",
    path: "src/a.ts",
    text: "forbidden",
  };

  it("passes when the substring is absent", () => {
    const outcome = runCheck(
      check,
      makeContext([makeFile("src/a.ts", "alpha\nbeta\n")]),
    );

    expect(outcome.status).toBe("PASS");
    expect(outcome.evidence[0]?.summary).toBe("Forbidden text marker not found.");
  });

  it("fails when the substring is present", () => {
    const outcome = runCheck(
      check,
      makeContext([makeFile("src/a.ts", "alpha\nforbidden\n")]),
    );

    expect(outcome.status).toBe("FAIL");
    expect(outcome.evidence[0]?.startLine).toBe(2);
  });

  it("fails when the file is missing", () => {
    const outcome = runCheck(check, makeContext([]));

    expect(outcome.status).toBe("FAIL");
  });
});

describe("runCheck dependency_present", () => {
  const check: Check = { type: "dependency_present", name: "zod" };

  it("passes when the dependency is declared", () => {
    const outcome = runCheck(
      check,
      makeContext([makeFile("package.json", '{"dependencies":{"zod":"^4"}}')], [
        "zod",
      ]),
    );

    expect(outcome.status).toBe("PASS");
    expect(outcome.evidence[0]?.summary).toBe("Declared dependency present.");
  });

  it("fails when the dependency is not declared", () => {
    const outcome = runCheck(
      check,
      makeContext([makeFile("package.json", '{"dependencies":{"react":"^19"}}')], [
        "react",
      ]),
    );

    expect(outcome.status).toBe("FAIL");
    expect(outcome.evidence[0]?.summary).toBe(
      "Declared dependency not present in package.json.",
    );
  });

  it("fails with an explicit summary when package.json is absent", () => {
    const outcome = runCheck(check, makeContext([]));

    expect(outcome.status).toBe("FAIL");
    expect(outcome.evidence[0]?.summary).toBe(
      "package.json not found; cannot confirm dependency.",
    );
  });
});

describe("runCheck dependency_absent", () => {
  const check: Check = { type: "dependency_absent", name: "shelljs" };

  it("passes when the dependency is not declared", () => {
    const outcome = runCheck(
      check,
      makeContext([makeFile("package.json", '{"dependencies":{"react":"^19"}}')], [
        "react",
      ]),
    );

    expect(outcome.status).toBe("PASS");
  });

  it("fails when the dependency is declared", () => {
    const outcome = runCheck(
      check,
      makeContext([makeFile("package.json", '{"dependencies":{"shelljs":"^0"}}')], [
        "shelljs",
      ]),
    );

    expect(outcome.status).toBe("FAIL");
    expect(outcome.evidence[0]?.summary).toBe(
      "Declared dependency present but must be absent.",
    );
  });

  it("passes when package.json is absent", () => {
    const outcome = runCheck(check, makeContext([]));

    expect(outcome.status).toBe("PASS");
    expect(outcome.evidence[0]?.summary).toBe(
      "package.json not found; dependency cannot be declared.",
    );
  });
});

describe("runCheck source_reference_exists", () => {
  it("passes for a relative import matching the referenced path", () => {
    const check: Check = {
      type: "source_reference_exists",
      path: "src/app.ts",
      referencedPath: "src/lib/util",
    };
    const outcome = runCheck(
      check,
      makeContext([
        makeFile("src/app.ts", 'import { util } from "./lib/util";\n'),
      ]),
    );

    expect(outcome.status).toBe("PASS");
    expect(outcome.evidence[0]?.type).toBe("source_reference");
    expect(outcome.evidence[0]?.startLine).toBe(1);
  });

  it("fails when no import matches the referenced path", () => {
    const check: Check = {
      type: "source_reference_exists",
      path: "src/app.ts",
      referencedPath: "src/lib/util",
    };
    const outcome = runCheck(
      check,
      makeContext([makeFile("src/app.ts", 'import { x } from "./other";\n')]),
    );

    expect(outcome.status).toBe("FAIL");
    expect(outcome.evidence[0]?.summary).toBe(
      "File does not statically reference src/lib/util.",
    );
  });

  it("fails when the file at path is missing", () => {
    const check: Check = {
      type: "source_reference_exists",
      path: "src/app.ts",
      referencedPath: "src/lib/util",
    };
    const outcome = runCheck(check, makeContext([]));

    expect(outcome.status).toBe("FAIL");
    expect(outcome.evidence[0]?.summary).toContain("File not present");
  });

  it("ignores package-style specifiers", () => {
    const check: Check = {
      type: "source_reference_exists",
      path: "src/app.ts",
      referencedPath: "react",
    };
    const outcome = runCheck(
      check,
      makeContext([
        makeFile(
          "src/app.ts",
          'import React from "react";\nimport x from "@scope/foo";\n',
        ),
      ]),
    );

    expect(outcome.status).toBe("FAIL");
  });

  it("fails with a parse-failure summary for malformed source", () => {
    const check: Check = {
      type: "source_reference_exists",
      path: "src/app.ts",
      referencedPath: "src/lib/util",
    };
    const outcome = runCheck(
      check,
      makeContext([
        makeFile(
          "src/app.ts",
          'import { util } from "./lib/util";\nconst broken = ;\n',
        ),
      ]),
    );

    expect(outcome.status).toBe("FAIL");
    expect(outcome.evidence[0]?.summary).toBe(
      "Static reference parsing failed for src/app.ts.",
    );
  });

  it("fails for an unsupported source file type", () => {
    const check: Check = {
      type: "source_reference_exists",
      path: "README.md",
      referencedPath: "src/lib/util",
    };
    const outcome = runCheck(
      check,
      makeContext([makeFile("README.md", 'import x from "./y";\n')]),
    );

    expect(outcome.status).toBe("FAIL");
    expect(outcome.evidence[0]?.summary).toBe(
      "README.md is not a supported JavaScript or TypeScript source file.",
    );
  });
});

describe("evidence drafts are content-free", () => {
  it("does not include source content or the matched marker text", () => {
    const marker = "DO_NOT_LEAK_MARKER_123";
    const outcome = runCheck(
      { type: "text_contains", path: "src/a.ts", text: marker },
      makeContext([makeFile("src/a.ts", `const value = "${marker}";\n`)]),
    );

    const firstDraft = outcome.evidence[0];

    expect(outcome.status).toBe("PASS");
    expect(firstDraft).toBeDefined();
    expect(firstDraft).not.toHaveProperty("content");
    expect(firstDraft).not.toHaveProperty("bytes");
    expect(JSON.stringify(outcome.evidence)).not.toContain(marker);
    expect(firstDraft?.origin).toBe("deterministic");
  });

  it("does not include the raw import specifier", () => {
    const outcome = runCheck(
      {
        type: "source_reference_exists",
        path: "src/app.ts",
        referencedPath: "src/lib/util",
      },
      makeContext([
        makeFile("src/app.ts", 'import { util } from "./lib/util";\n'),
      ]),
    );

    expect(JSON.stringify(outcome.evidence)).not.toContain("./lib/util");
  });

  it("does not embed content for any check type", () => {
    const marker = "LEAK_CANARY_987";
    const context = makeContext(
      [
        makeFile(
          "src/a.ts",
          `import x from "./b";\nconst value = "${marker}";\nexport { x };\n`,
        ),
        makeFile("src/b.ts", "export const b = 1;\n"),
        makeFile("package.json", '{"dependencies":{"zod":"^4"}}'),
      ],
      ["zod"],
    );
    const checks: Check[] = [
      { type: "file_exists", path: "src/a.ts" },
      { type: "file_absent", path: "src/missing.ts" },
      { type: "text_contains", path: "src/a.ts", text: marker },
      { type: "text_not_contains", path: "src/a.ts", text: "forbidden" },
      { type: "dependency_present", name: "zod" },
      { type: "dependency_absent", name: "shelljs" },
      {
        type: "source_reference_exists",
        path: "src/a.ts",
        referencedPath: "src/b",
      },
    ];

    for (const check of checks) {
      const outcome = runCheck(check, context);
      const serialized = JSON.stringify(outcome.evidence);

      expect(serialized).not.toContain(marker);
      expect(serialized).not.toContain("./b");

      for (const draft of outcome.evidence) {
        expect(draft).not.toHaveProperty("content");
        expect(draft).not.toHaveProperty("bytes");
      }
    }
  });
});

describe("runChecks", () => {
  it("combines per-requirement checks and lists failures first", () => {
    const requirement: Requirement = {
      id: "REQ-A",
      title: "A",
      description: "A",
      severity: "high",
      verificationMode: "deterministic",
      checks: [
        { type: "file_exists", path: "src/a.ts" },
        { type: "text_contains", path: "src/a.ts", text: "needle" },
      ],
    };
    const results = runChecks(
      [requirement],
      makeContext([makeFile("src/a.ts", "haystack\n")]),
    );

    expect(results.get("REQ-A")?.status).toBe("FAIL");
    expect(results.get("REQ-A")?.evidence[0]?.summary).toBe(
      "Required text marker not found.",
    );
  });

  it("passes when all checks pass", () => {
    const requirement: Requirement = {
      id: "REQ-A",
      title: "A",
      description: "A",
      severity: "high",
      verificationMode: "deterministic",
      checks: [{ type: "file_exists", path: "src/a.ts" }],
    };
    const results = runChecks(
      [requirement],
      makeContext([makeFile("src/a.ts", "export {};\n")]),
    );

    expect(results.get("REQ-A")?.status).toBe("PASS");
  });

  it("omits requirements with no checks", () => {
    const requirement: Requirement = {
      id: "REQ-NONE",
      title: "None",
      description: "None",
      severity: "low",
      verificationMode: "deterministic",
      checks: [],
    };
    const results = runChecks([requirement], makeContext([]));

    expect(results.size).toBe(0);
  });
});
