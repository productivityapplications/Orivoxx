import {
  AdapterIdSchema,
  AgentCommandSchema,
  type AdapterRunInput,
  type AgentAdapter,
} from "../contracts.js";
import { buildAdapterRunInput } from "../run.js";
import { getTask } from "@orivoxx/benchmarks";
import { describe, expect, it } from "vitest";

import { createAiderOpenRouterAdapter, AIDER_RUNNER_SCRIPT } from "./aider.js";
import {
  createPythonOpenRouterAdapter,
  AGENT_SCRIPT,
  REAL_AGENT_SCRIPT,
} from "./python.js";
import { adapterSummaries, getAdapter, listAdapters } from "./registry.js";

function runInput(adapter: AgentAdapter, overrides: Partial<AdapterRunInput> = {}): AdapterRunInput {
  const base = buildAdapterRunInput(getTask("taskboard"), { model: adapter.model });

  return { ...base, ...overrides };
}

function processCommand(adapter: AgentAdapter) {
  const plan = adapter.plan(runInput(adapter));

  if (plan.kind !== "process") {
    throw new Error("Expected a process plan.");
  }

  return AgentCommandSchema.parse(plan.command);
}

describe("python-openrouter adapter", () => {
  it("plans the in-image agent loop against the model proxy", () => {
    const adapter = createPythonOpenRouterAdapter({ modelName: "openai/gpt-4o-mini" });
    const command = processCommand(adapter);

    expect(adapter.id).toBe("python-openrouter");
    expect(adapter.kind).toBe("harness");
    expect(adapter.model).toEqual({
      provider: "openrouter",
      name: "openai/gpt-4o-mini",
      baseUrl: "https://openrouter.ai/api/v1",
    });
    expect(command.file).toBe("python3");
    expect(command.args).toEqual([AGENT_SCRIPT]);
    expect(command.env).toEqual({
      MODEL_PROXY_URL: "http://model-proxy:8080/v1",
      MODEL_NAME: "openai/gpt-4o-mini",
      MAX_STEPS: "40",
      TASK_ID: "taskboard",
      ORIVOXX_CHAOS: "none",
      ISSUE_PATH: "/workspace/.orivoxx/issue.md",
      PYTHONUNBUFFERED: "1",
    });
    expect(JSON.stringify(command)).not.toMatch(/sk-or-v1-/);
  });

  it("uses the real-repository runner when an issue file is present", () => {
    const adapter = createPythonOpenRouterAdapter({ modelName: "openai/gpt-4o-mini" });
    const plan = adapter.plan(
      runInput(adapter, {
        startingFiles: [{ path: ".orivoxx/issue.md", content: "# Issue" }],
      }),
    );

    expect(plan.kind).toBe("process");
    if (plan.kind === "process") {
      expect(plan.command.args).toEqual([REAL_AGENT_SCRIPT]);
    }
  });

  it("records a different model when asked for the demo second model", () => {
    const adapter = createPythonOpenRouterAdapter({
      modelName: "deepseek/deepseek-chat-v3-0324",
    });

    expect(adapter.model?.name).toBe("deepseek/deepseek-chat-v3-0324");
    expect(adapter.label).toContain("deepseek/deepseek-chat-v3-0324");
  });

  it("refuses a run without the model proxy", () => {
    const adapter = createPythonOpenRouterAdapter();

    expect(() => adapter.plan(runInput(adapter, { network: "none" }))).toThrow(
      /model-proxy network/,
    );
  });

  it("refuses a run bound to a different model", () => {
    const adapter = createPythonOpenRouterAdapter({ modelName: "openai/gpt-4o-mini" });
    const input = runInput(adapter, {
      model: {
        provider: "openrouter",
        name: "deepseek/deepseek-chat-v3-0324",
        baseUrl: "https://openrouter.ai/api/v1",
      },
    });

    expect(() => adapter.plan(input)).toThrow(/different model/);
  });
});

describe("aider-openrouter adapter", () => {
  it("plans the pinned Aider wrapper with the proxy sentinel", () => {
    const adapter = createAiderOpenRouterAdapter({ modelName: "openai/gpt-4o-mini" });
    const command = processCommand(adapter);

    expect(adapter.id).toBe("aider-openrouter");
    expect(adapter.label).toContain("Aider 0.86.2");
    expect(command.file).toBe("python3");
    expect(command.args).toEqual([AIDER_RUNNER_SCRIPT]);
    expect(command.env.OPENAI_API_KEY).toBe("orivoxx-sandbox-proxy");
    expect(command.env.AIDER_OPENAI_API_KEY).toBe("orivoxx-sandbox-proxy");
    expect(command.env.MODEL_PROXY_URL).toBe("http://model-proxy:8080/v1");
  });

  it("refuses a run without the model proxy", () => {
    const adapter = createAiderOpenRouterAdapter();

    expect(() => adapter.plan(runInput(adapter, { network: "none" }))).toThrow(
      /model-proxy network/,
    );
  });

  it("refuses a provider-shaped secret in the environment", () => {
    const adapter = createAiderOpenRouterAdapter();
    const command = processCommand(adapter);

    expect(() =>
      AgentCommandSchema.parse({
        ...command,
        env: { ...command.env, OPENAI_API_KEY: "sk-or-v1-abcdefghijklmnopqrstuvwx" },
      }),
    ).toThrow(/sentinel/);
  });
});

describe("adapter registry", () => {
  it("lists the baseline and brand harnesses", () => {
    const summaries = adapterSummaries();

    expect(summaries.map((entry) => entry.id)).toEqual([
      "fake",
      "claude-code-openrouter",
      "codex-openrouter",
      "aider-openrouter",
    ]);
    expect(summaries[0]?.model).toBeNull();
    expect(summaries[1]?.kind).toBe("harness");
    expect(summaries[2]?.kind).toBe("harness");
    expect(listAdapters()).toHaveLength(4);
  });

  it("resolves an adapter by id and rejects an unknown one", () => {
    expect(getAdapter("claude-code-openrouter").id).toBe("claude-code-openrouter");
    expect(() => getAdapter("opencode")).toThrow(/Unknown adapter/);
  });

  it("uses only contract-valid adapter ids", () => {
    for (const adapter of listAdapters()) {
      expect(AdapterIdSchema.safeParse(adapter.id).success, adapter.id).toBe(true);
    }
  });
});
