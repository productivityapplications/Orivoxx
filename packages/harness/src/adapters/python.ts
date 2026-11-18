import {
  AdapterIdSchema,
  type AdapterPlan,
  type AdapterRunInput,
  type AgentAdapter,
} from "../contracts.js";
import { HarnessError } from "../errors.js";
import { resolveOpenRouterModel, type OpenRouterModelOptions } from "./model.js";

export const PYTHON_ADAPTER_ID = "python-openrouter";
export const PYTHON_ADAPTER_VERSION = "1.0.0";
export const AGENT_SCRIPT = "/opt/orivoxx/agents/python_openrouter.py";

export type OpenRouterAdapterOptions = OpenRouterModelOptions;

/**
 * A custom Python agent loop using only the standard library. It plans a file
 * set from the specification, then asks the model for one complete file per
 * step. No package installation and no produced-code execution.
 */
export function createPythonOpenRouterAdapter(
  options: OpenRouterAdapterOptions = {},
): AgentAdapter {
  const model = resolveOpenRouterModel(options);

  return {
    id: AdapterIdSchema.parse(PYTHON_ADAPTER_ID),
    version: PYTHON_ADAPTER_VERSION,
    label: `Python agent loop (${model.name})`,
    kind: "harness",
    model,
    plan(input: AdapterRunInput): AdapterPlan {
      if (input.network !== "model-proxy") {
        throw new HarnessError(
          "invalid_run_input",
          "The python-openrouter adapter requires the model-proxy network.",
        );
      }

      if (input.model !== null && input.model.name !== model.name) {
        throw new HarnessError(
          "invalid_run_input",
          "The adapter is bound to a different model than the run input declares.",
        );
      }

      return {
        kind: "process",
        command: {
          file: "python3",
          args: [AGENT_SCRIPT],
          env: {
            MODEL_PROXY_URL: "http://model-proxy:8080/v1",
            MODEL_NAME: model.name,
            MAX_STEPS: String(input.limits.maxSteps),
            TASK_ID: input.task.id,
            ORIVOXX_CHAOS: input.chaos,
            PYTHONUNBUFFERED: "1",
          },
        },
      };
    },
  };
}
