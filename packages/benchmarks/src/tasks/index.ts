import type { ProjectFile } from "@orivoxx/core";

import type { TaskDefinition } from "../contracts/task.js";
import { LINKSTASH_FIXTURES, LINKSTASH_TASK } from "./linkstash/index.js";
import { TaskRegistry } from "./registry.js";
import { TASKBOARD_FIXTURES, TASKBOARD_TASK } from "./taskboard/index.js";

export { LINKSTASH_FIXTURES, LINKSTASH_TASK } from "./linkstash/index.js";
export { TASKBOARD_FIXTURES, TASKBOARD_TASK } from "./taskboard/index.js";
export * from "./real.js";
export * from "./real-registry.js";
export {
  TaskNotFoundError,
  TaskRegistry,
  TaskRegistryError,
  type TaskRegistryOptions,
} from "./registry.js";
export {
  buildRuleset,
  buildTaskDefinition,
  TaskDefinitionError,
  type BuildTaskDefinitionInput,
  type TaskDefinitionErrorCode,
} from "./build.js";

export type TaskFixtureVariant = "compliant" | "regressed";

export type TaskFixtures = Record<TaskFixtureVariant, readonly ProjectFile[]>;

export const TASK_DEFINITIONS: readonly TaskDefinition[] = [
  TASKBOARD_TASK,
  LINKSTASH_TASK,
];

export const TASK_FIXTURES: Readonly<Record<string, TaskFixtures>> = {
  taskboard: TASKBOARD_FIXTURES,
  linkstash: LINKSTASH_FIXTURES,
};

export const taskRegistry = new TaskRegistry(TASK_DEFINITIONS, {
  pinnedIds: ["taskboard"],
});

export function listTasks() {
  return taskRegistry.list();
}

export function getTask(taskId: string, version?: string): TaskDefinition {
  return taskRegistry.get(taskId, version);
}

export function getTaskFixtures(taskId: string): TaskFixtures | undefined {
  return TASK_FIXTURES[taskId];
}
