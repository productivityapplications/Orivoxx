import {
  AdapterIdSchema,
  type AdapterPlan,
  type AdapterRunInput,
  type AgentAdapter,
} from "../contracts.js";
import { HarnessError } from "../errors.js";
import { resolveOpenRouterModel, type OpenRouterModelOptions } from "./model.js";

export const AIDER_ADAPTER_ID = "aider-openrouter";
export const AIDER_ADAPTER_VERSION = "1.0.0";
export const AIDER_RUNNER_SCRIPT = "/opt/orivoxx/agents/aider_runner.py";
export const REAL_AIDER_RUNNER_SCRIPT = "/opt/orivoxx/agents/real_aider_runner.py";
export const AIDER_VERSION = "0.86.2";

export type AiderAdapterOptions = OpenRouterModelOptions;

/**
 * Aider as a second harness. The wrapper derives the editable file set from the
 * task specification, runs Aider against the allowlisted proxy, and keeps its
 * history files outside the workspace. Aider is pinned in the sandbox image.
 */
export function createAiderOpenRouterAdapter(
  options: AiderAdapterOptions = {},
): AgentAdapter {
  const model = resolveOpenRouterModel(options);

  return {
    id: AdapterIdSchema.parse(AIDER_ADAPTER_ID),
    version: AIDER_ADAPTER_VERSION,
    label: `Aider ${AIDER_VERSION} (${model.name})`,
    kind: "harness",
    model,
    plan(input: AdapterRunInput): AdapterPlan {
      if (input.network !== "model-proxy") {
        throw new HarnessError(
          "invalid_run_input",
          "The aider-openrouter adapter requires the model-proxy network.",
        );
      }

      if (input.model !== null && input.model.name !== model.name) {
        throw new HarnessError(
          "invalid_run_input",
          "The adapter is bound to a different model than the run input declares.",
        );
      }

      const script = input.startingFiles.some((file) => file.path === ".orivoxx/issue.md")
        ? REAL_AIDER_RUNNER_SCRIPT
        : AIDER_RUNNER_SCRIPT;

      return {
        kind: "process",
        command: {
          file: "python3",
          args: [script],
          env: {
            MODEL_PROXY_URL: "http://model-proxy:8080/v1",
            MODEL_NAME: model.name,
            TASK_ID: input.task.id,
            OPENAI_API_KEY: "orivoxx-sandbox-proxy",
            AIDER_OPENAI_API_KEY: "orivoxx-sandbox-proxy",
            ORIVOXX_CHAOS: input.chaos,
            PYTHONUNBUFFERED: "1",
          },
        },
      };
    },
  };
}
