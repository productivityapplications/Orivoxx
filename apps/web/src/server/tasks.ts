import "server-only";

import {
  getTask,
  listTasks,
  type TaskDifficulty,
  type TaskRequirement,
} from "@orivoxx/benchmarks";

export interface TaskSummaryView {
  id: string;
  version: string;
  title: string;
  summary: string;
  difficulty: TaskDifficulty;
  tags: string[];
  rulesetVersion: string;
  scoringConfigVersion: string;
  requirementCount: number;
  benchCounts: { spec: number; security: number };
  timeLimitSeconds: number;
  pinned: boolean;
  passThreshold: number;
}

export interface TaskRequirementView {
  id: string;
  title: string;
  description: string;
  severity: TaskRequirement["severity"];
  bench: TaskRequirement["bench"];
  checks: {
    type: string;
    path?: string;
    text?: string;
    name?: string;
  }[];
}

export interface TaskDetailView extends TaskSummaryView {
  specText: string;
  network: "none" | "model-proxy";
  maxSteps: number;
  maxOutputBytes: number;
  startingFiles: { path: string; size: number }[];
  requirements: TaskRequirementView[];
  caps: { criticalSpec: number; criticalSecurity: number };
  benchWeights: { spec: number; security: number; maintainability: number };
}

const cache = new Map<string, TaskDetailView>();

function requirementView(requirement: TaskRequirement): TaskRequirementView {
  return {
    id: requirement.id,
    title: requirement.title,
    description: requirement.description,
    severity: requirement.severity,
    bench: requirement.bench,
    checks: requirement.checks.map((check) => {
      const record = check as Record<string, unknown>;

      return {
        type: String(record.type),
        ...(typeof record.path === "string" ? { path: record.path } : {}),
        ...(typeof record.text === "string" ? { text: record.text } : {}),
        ...(typeof record.name === "string" ? { name: record.name } : {}),
      };
    }),
  };
}

function displayOrder(task: { id: string; pinned: boolean }): number {
  if (task.pinned) {
    return 0;
  }

  return task.id === "taskboard" ? 1 : 2;
}

export function taskSummaries(): TaskSummaryView[] {
  return listTasks()
    .map((task) => ({
    id: task.id,
    version: task.version,
    title: task.title,
    summary: task.summary,
    difficulty: task.difficulty,
    tags: [...task.tags],
    rulesetVersion: task.rulesetVersion,
    scoringConfigVersion: task.scoringConfigVersion,
    requirementCount: task.requirementCount,
    benchCounts: task.benchCounts,
      timeLimitSeconds: task.timeLimitSeconds,
      pinned: task.pinned,
      passThreshold: 70,
    }))
    .sort((left, right) => displayOrder(left) - displayOrder(right) || left.id.localeCompare(right.id));
}

export function taskDetail(taskId: string): TaskDetailView | null {
  const cached = cache.get(taskId);

  if (cached !== undefined) {
    return cached;
  }

  let task: ReturnType<typeof getTask>;

  try {
    task = getTask(taskId);
  } catch {
    return null;
  }

  const detail: TaskDetailView = {
    id: task.manifest.id,
    version: task.manifest.version,
    title: task.manifest.title,
    summary: task.manifest.summary,
    difficulty: task.manifest.difficulty,
    tags: [...task.manifest.tags],
    rulesetVersion: task.manifest.rulesetVersion,
    scoringConfigVersion: task.manifest.scoringConfigVersion,
    requirementCount: task.ruleset.requirements.length,
    benchCounts: {
      spec: task.ruleset.requirements.filter((entry) => entry.bench === "spec").length,
      security: task.ruleset.requirements.filter((entry) => entry.bench === "security").length,
    },
    timeLimitSeconds: task.manifest.timeLimitSeconds,
    pinned: false,
    passThreshold: 70,
    specText: task.specText,
    network: task.manifest.network,
    maxSteps: task.manifest.maxSteps,
    maxOutputBytes: task.manifest.maxOutputBytes,
    startingFiles: task.manifest.startingFiles.map((file) => ({
      path: file.path,
      size: Buffer.byteLength(file.content, "utf8"),
    })),
    requirements: task.ruleset.requirements.map(requirementView),
    caps: {
      criticalSpec: task.scoringConfig.caps.criticalSpec,
      criticalSecurity: task.scoringConfig.caps.criticalSecurity,
    },
    benchWeights: {
      spec: task.scoringConfig.benchWeights.spec,
      security: task.scoringConfig.benchWeights.security,
      maintainability: task.scoringConfig.benchWeights.maintainability,
    },
  };

  cache.set(taskId, detail);

  return detail;
}
