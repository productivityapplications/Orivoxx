import {
  TaskDefinitionSchema,
  type TaskDefinition,
  type TaskSummary,
} from "../contracts/task.js";

export class TaskNotFoundError extends Error {
  readonly code = "task_not_found";
  readonly taskId: string;
  readonly version?: string;

  constructor(taskId: string, version?: string) {
    super(
      version === undefined
        ? `Unknown benchmark task "${taskId}".`
        : `Unknown benchmark task "${taskId}" version "${version}".`,
    );
    this.name = "TaskNotFoundError";
    this.taskId = taskId;
    this.version = version;
  }
}

export class TaskRegistryError extends Error {
  readonly code = "invalid_task_registry";

  constructor(message: string) {
    super(message);
    this.name = "TaskRegistryError";
  }
}

function compareSemver(left: string, right: string): number {
  const leftParts = left.split(/[.-]/).map((part) => Number.parseInt(part, 10));
  const rightParts = right.split(/[.-]/).map((part) => Number.parseInt(part, 10));
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return left.localeCompare(right);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export interface TaskRegistryOptions {
  pinnedIds?: readonly string[];
}

export class TaskRegistry {
  readonly #definitions: readonly TaskDefinition[];
  readonly #byId = new Map<string, TaskDefinition[]>();
  readonly #pinnedIds: ReadonlySet<string>;

  constructor(definitions: readonly TaskDefinition[], options: TaskRegistryOptions = {}) {
    if (definitions.length === 0) {
      throw new TaskRegistryError("At least one benchmark task is required.");
    }

    const seen = new Set<string>();
    const validated: TaskDefinition[] = [];

    for (const definition of definitions) {
      const parsed = TaskDefinitionSchema.safeParse(definition);

      if (!parsed.success) {
        throw new TaskRegistryError(
          `Invalid task definition: ${parsed.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; ")}`,
        );
      }

      const key = `${parsed.data.manifest.id}@${parsed.data.manifest.version}`;

      if (seen.has(key)) {
        throw new TaskRegistryError(`Duplicate task definition ${key}.`);
      }

      const benches = new Set(
        parsed.data.ruleset.requirements.map((requirement) => requirement.bench),
      );

      if (!benches.has("spec") || !benches.has("security")) {
        throw new TaskRegistryError(
          `Task ${key} must declare at least one spec and one security requirement.`,
        );
      }

      seen.add(key);
      validated.push(parsed.data);

      const versions = this.#byId.get(parsed.data.manifest.id) ?? [];
      versions.push(parsed.data);
      versions.sort((left, right) =>
        compareSemver(right.manifest.version, left.manifest.version),
      );
      this.#byId.set(parsed.data.manifest.id, versions);
    }

    this.#definitions = validated;
    this.#pinnedIds = new Set(options.pinnedIds ?? []);
  }

  list(): TaskSummary[] {
    return [...this.#byId.entries()]
      .map(([, versions]) => versions[0])
      .filter((definition): definition is TaskDefinition => definition !== undefined)
      .map((definition) => this.#toSummary(definition))
      .sort(
        (left, right) =>
          compareStrings(left.title, right.title) || compareStrings(left.id, right.id),
      );
  }

  versions(taskId: string): string[] {
    return (this.#byId.get(taskId) ?? []).map((definition) => definition.manifest.version);
  }

  get(taskId: string, version?: string): TaskDefinition {
    const versions = this.#byId.get(taskId);

    if (versions === undefined || versions.length === 0) {
      throw new TaskNotFoundError(taskId, version);
    }

    if (version === undefined) {
      const latest = versions[0];

      if (latest === undefined) {
        throw new TaskNotFoundError(taskId);
      }

      return latest;
    }

    const match = versions.find((definition) => definition.manifest.version === version);

    if (match === undefined) {
      throw new TaskNotFoundError(taskId, version);
    }

    return match;
  }

  all(): readonly TaskDefinition[] {
    return this.#definitions;
  }

  #toSummary(definition: TaskDefinition): TaskSummary {
    const benchCounts = { spec: 0, security: 0 };

    for (const requirement of definition.ruleset.requirements) {
      benchCounts[requirement.bench] += 1;
    }

    return {
      id: definition.manifest.id,
      version: definition.manifest.version,
      title: definition.manifest.title,
      summary: definition.manifest.summary,
      difficulty: definition.manifest.difficulty,
      tags: [...definition.manifest.tags],
      rulesetVersion: definition.manifest.rulesetVersion,
      scoringConfigVersion: definition.manifest.scoringConfigVersion,
      requirementCount: definition.ruleset.requirements.length,
      benchCounts,
      timeLimitSeconds: definition.manifest.timeLimitSeconds,
      pinned: this.#pinnedIds.has(definition.manifest.id),
    };
  }
}
