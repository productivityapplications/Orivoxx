import {
  AdapterIdSchema,
  AdapterModelSchema,
  type AdapterPlan,
  type AdapterRunInput,
  type AgentAdapter,
} from "../contracts.js";
import { HarnessError } from "../errors.js";

export const BRAND_RUNNER_SCRIPT = "/opt/orivoxx/agents/brand_runner.py";

export type BrandAgentId = "claude-code-openrouter" | "codex-openrouter" | "copilot-openrouter";

const BRAND: Record<BrandAgentId, { label: string; model: string }> = {
  "claude-code-openrouter": { label: "Claude Code", model: "anthropic/claude-sonnet-4.5" },
  "codex-openrouter": { label: "OpenAI Codex CLI", model: "openai/gpt-5.1-codex" },
  "copilot-openrouter": { label: "GitHub Copilot CLI", model: "openai/gpt-5.1" },
};

export function createBrandAdapter(id: BrandAgentId): AgentAdapter {
  const brand = BRAND[id];
  const model = AdapterModelSchema.parse({
    provider: "openrouter",
    name: brand.model,
    baseUrl: "https://openrouter.ai/api/v1",
  });

  return {
    id: AdapterIdSchema.parse(id),
    version: "1.0.0",
    label: `${brand.label} (${brand.model})`,
    kind: "harness",
    model,
    plan(input: AdapterRunInput): AdapterPlan {
      if (input.network !== "model-proxy") {
        throw new HarnessError("invalid_run_input", `${id} requires the model-proxy network.`);
      }

      if (input.model !== null && input.model.name !== model.name) {
        throw new HarnessError("invalid_run_input", "The adapter is bound to a different model.");
      }

      return {
        kind: "process",
        command: {
          file: "python3",
          args: [BRAND_RUNNER_SCRIPT],
          env: {
            BRAND_AGENT: id.replace("-openrouter", "").replace("-code", ""),
            MODEL_PROXY_URL: "http://model-proxy:8080/v1",
            MODEL_NAME: model.name,
            ISSUE_PATH: "/workspace/.orivoxx/issue.md",
            ANTHROPIC_BASE_URL: "http://model-proxy:8080",
            ANTHROPIC_AUTH_TOKEN: "orivoxx-sandbox-proxy",
            ANTHROPIC_API_KEY: "",
            CLAUDE_CODE_MAX_OUTPUT_TOKENS: "8192",
            OPENAI_API_KEY: "orivoxx-sandbox-proxy",
            CODEX_HOME: "/tmp/.codex",
            TASK_ID: input.task.id,
            MAX_STEPS: String(input.limits.maxSteps),
            PYTHONUNBUFFERED: "1",
          },
        },
      };
    },
  };
}
