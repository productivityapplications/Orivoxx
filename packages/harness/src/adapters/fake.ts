import { getTaskFixtures } from "@orivoxx/benchmarks";

import {
  AdapterIdSchema,
  type AdapterPlan,
  type AdapterRunInput,
  type AgentAdapter,
} from "../contracts.js";
import { HarnessError } from "../errors.js";

export const FAKE_ADAPTER_ID = "fake";
export const FAKE_ADAPTER_VERSION = "1.0.0";

export type FakeFixtureVariant = "compliant" | "regressed";

export interface FakeAdapterOptions {
  taskId?: string;
  variant?: FakeFixtureVariant;
}

/**
 * The fake adapter never calls a model. It materializes a synthetic fixture so
 * the deterministic pipeline, the sandbox plumbing, and CI can run end to end.
 * It is a baseline row, never evidence about an agent or a model.
 */
export function createFakeAdapter(options: FakeAdapterOptions = {}): AgentAdapter {
  const taskId = options.taskId ?? "taskboard";
  const variant = options.variant ?? "compliant";
  const fixtures = getTaskFixtures(taskId);

  if (fixtures === undefined) {
    throw new HarnessError("invalid_run_input", `Unknown task "${taskId}".`);
  }

  const files = fixtures[variant];

  if (files.length === 0) {
    throw new HarnessError(
      "invalid_run_input",
      `Task "${taskId}" has no ${variant} fixture.`,
    );
  }

  return {
    id: AdapterIdSchema.parse(FAKE_ADAPTER_ID),
    version: FAKE_ADAPTER_VERSION,
    label: `Fake fixture (${taskId}/${variant})`,
    kind: "baseline",
    model: null,
    plan(input: AdapterRunInput): AdapterPlan {
      if (input.task.id !== taskId) {
        throw new HarnessError(
          "invalid_run_input",
          `The fake adapter is bound to task "${taskId}", not "${input.task.id}".`,
        );
      }

      return { kind: "materialize", files };
    },
  };
}

export const fakeAdapter: AgentAdapter = createFakeAdapter();
