import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { NormalizedFile } from "../archive/types";
import {
  extractStaticReferences,
  parseStaticReferences,
} from "./static-references";

function countLines(content: string): number {
  if (content.length === 0) {
    return 0;
  }

  return content.endsWith("\n")
    ? content.split("\n").length - 1
    : content.split("\n").length;
}

function makeFile(path: string, content: string): NormalizedFile {
  const normalized = content.replace(/\r\n?/g, "\n");

  return {
    path,
    bytes: new TextEncoder().encode(normalized),
    content: normalized,
    lineCount: countLines(normalized),
    fingerprint: createHash("sha256").update(normalized, "utf8").digest("hex"),
    language: "typescript",
    redacted: false,
  };
}

describe("extractStaticReferences", () => {
  it("extracts a static import from the importing file directory", () => {
    expect(
      extractStaticReferences(makeFile("a.ts", 'import x from "./y";\n')),
    ).toEqual(["y"]);
  });

  it("extracts export-from declarations and resolves parent directories", () => {
    expect(
      extractStaticReferences(
        makeFile("src/features/a.ts", 'export { x } from "../z";\n'),
      ),
    ).toEqual(["src/z"]);
  });

  it("extracts literal require and dynamic import calls", () => {
    expect(
      extractStaticReferences(
        makeFile(
          "a.ts",
          'const a = require("./a");\nconst b = import("./b");\n',
        ),
      ),
    ).toEqual(["a", "b"]);
  });

  it("returns an empty list on parse errors", () => {
    expect(
      extractStaticReferences(
        makeFile("a.ts", 'import x from "./y";\nconst broken = ;\n'),
      ),
    ).toEqual([]);
  });

  it("ignores non-relative package and alias specifiers", () => {
    expect(
      extractStaticReferences(
        makeFile(
          "a.ts",
          'import react from "react";\nimport x from "@scope/foo";\nimport y from "/absolute";\n',
        ),
      ),
    ).toEqual([]);
  });

  it("does not evaluate code or resolve computed require arguments", () => {
    expect(
      extractStaticReferences(
        makeFile(
          "a.ts",
          'throw new Error("boom");\nconst name = "./x";\nrequire(name);\nimport("./dynamic");\n',
        ),
      ),
    ).toEqual(["dynamic"]);
  });

  it("does not resolve paths that escape the project root", () => {
    expect(
      extractStaticReferences(
        makeFile("src/a.ts", 'import x from "../../outside";\n'),
      ),
    ).toEqual([]);
  });

  it("supports tsx files", () => {
    expect(
      extractStaticReferences(
        makeFile(
          "src/App.tsx",
          'import { Button } from "./Button";\nexport function App() { return <Button />; }\n',
        ),
      ),
    ).toEqual(["src/Button"]);
  });

  it("deduplicates references and sorts them deterministically", () => {
    expect(
      extractStaticReferences(
        makeFile(
          "a.ts",
          'import a from "./b";\nimport b from "./a";\nimport c from "./b";\n',
        ),
      ),
    ).toEqual(["a", "b"]);
  });
});

describe("parseStaticReferences", () => {
  it("reports unsupported languages", () => {
    const parsed = parseStaticReferences(
      makeFile("README.md", 'import x from "./y";\n'),
    );

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.reason).toBe("unsupported_language");
    }
  });

  it("records the declaration line for each reference", () => {
    const parsed = parseStaticReferences(
      makeFile("a.ts", 'const value = 1;\nimport { y } from "./y";\n'),
    );

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.references).toEqual([{ path: "y", line: 2 }]);
    }
  });
});
