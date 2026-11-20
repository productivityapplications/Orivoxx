import { describe, expect, it } from "vitest";

import { parseTestCommand } from "./test-command.js";

describe("test command parsing", () => {
  it("parses a node -e command with a quoted script", () => {
    const command = parseTestCommand(
      `node -e "import('./index.js').then(({isDecimal})=>process.exit(isDecimal('12')?1:0))"`,
    );

    expect(command.file).toBe("node");
    expect(command.args[0]).toBe("-e");
    expect(command.args[1]).toContain("isDecimal('12')");
    expect(command.env).toEqual({});
  });

  it("accepts the allowlisted executables", () => {
    for (const command of ["pytest -q", "python3 -m unittest", "npm test", "cargo test", "go test ./...", "make test"]) {
      expect(parseTestCommand(command).file).toBe(command.split(" ")[0]);
    }
  });

  it("rejects shell operators, pipes, redirects, and substitutions", () => {
    for (const command of [
      "pytest; rm -rf /",
      "npm test && echo ok",
      "node -e 'x' | cat",
      "python3 -m pytest > out.txt",
      "node -e \"$(id)\"",
      "node -e `id`",
    ]) {
      expect(() => parseTestCommand(command), command).toThrow(/shell operator|redirect/);
    }
  });

  it("rejects an unknown executable and unterminated quotes", () => {
    expect(() => parseTestCommand("bash -c 'echo hi'")).toThrow(/allowlisted/);
    expect(() => parseTestCommand('node -e "unterminated')).toThrow(/unterminated/);
  });
});
