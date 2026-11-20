import { AgentCommandSchema, type AgentCommand } from "./contracts.js";
import { HarnessError } from "./errors.js";

const SHELL_OPERATORS = /[|&;`\r\n]|\$\(/;
const ALLOWED_EXECUTABLES = new Set([
  "pytest",
  "python",
  "python3",
  "npm",
  "yarn",
  "pnpm",
  "node",
  "cargo",
  "go",
  "make",
]);

/** Splits a command into argv without invoking a shell. */
export function parseTestCommand(command: string): AgentCommand {
  const trimmed = command.trim();

  if (trimmed.length === 0 || trimmed.length > 500) {
    throw new HarnessError("invalid_test_command", "The test command is empty or too long.");
  }

  if (SHELL_OPERATORS.test(trimmed)) {
    throw new HarnessError(
      "invalid_test_command",
      "The test command contains a shell operator; use a single argv command.",
    );
  }

  const args: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index];

    if (quote !== null) {
      if (character === quote) {
        quote = null;
      } else if (character === "\\" && quote === '"' && index + 1 < trimmed.length) {
        index += 1;
        current += trimmed[index];
      } else {
        current += character;
      }
      continue;
    }

    if (character === ">" || character === "<") {
      throw new HarnessError(
        "invalid_test_command",
        "The test command contains a redirect; use a single argv command.",
      );
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character === " ") {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += character;
  }

  if (quote !== null) {
    throw new HarnessError("invalid_test_command", "The test command has an unterminated quote.");
  }

  if (current.length > 0) {
    args.push(current);
  }

  const [file, ...rest] = args;

  if (file === undefined || !ALLOWED_EXECUTABLES.has(file)) {
    throw new HarnessError(
      "invalid_test_command",
      "The test command must start with an allowlisted executable.",
    );
  }

  return AgentCommandSchema.parse({ file, args: rest, env: {} });
}
