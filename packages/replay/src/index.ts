import type { TaskDefinition } from "@orivoxx/benchmarks";
import { evaluateRepository, normalizeProjectFiles } from "@orivoxx/benchmarks";
import {
  CounterfactualOutcomeSchema,
  type CounterfactualOutcome,
  type ExitReason,
  type Intervention,
  type ReplayAction,
} from "@orivoxx/core";

export interface ReplayBaseline {
  overall: number;
  exitReason: ExitReason;
}

export interface ReplayInput {
  task: TaskDefinition;
  actions: readonly ReplayAction[];
  baseline: ReplayBaseline;
  intervention: Intervention;
  /** Steps whose recorded action failed in the baseline trace. */
  failedSteps?: readonly number[];
  /** Replacement content for action_replacement. */
  replacement?: { path: string; content: string } | null;
  passThreshold?: number;
  adapterVersion?: string;
}

export interface ReplayResult {
  outcome: CounterfactualOutcome;
  files: { path: string; content: string }[];
}

function validPath(path: string): boolean {
  if (
    path.length === 0 ||
    path.length > 1024 ||
    path.startsWith("/") ||
    path.includes("..") ||
    path.includes("\\") ||
    path.includes("\0")
  ) {
    return false;
  }

  return path
    .split("/")
    .every((part) => part.length > 0 && /^[A-Za-z0-9._@()\[\]-]+$/.test(part));
}

function sortActions(actions: readonly ReplayAction[]): ReplayAction[] {
  return [...actions]
    .filter((action) => validPath(action.path))
    .sort((left, right) => left.stepIndex - right.stepIndex)
    .slice(0, 500);
}

/**
 * Deterministic counterfactual replay. It writes recorded text actions into an
 * in-memory file map and scores the result statically. It never calls a model,
 * never executes produced code, and never touches the filesystem.
 */
export function replay(input: ReplayInput): ReplayResult {
  const passThreshold = input.passThreshold ?? 70;
  const failed = new Set(input.failedSteps ?? []);
  const actions = sortActions(input.actions);
  const files = new Map<string, string>(
    input.task.manifest.startingFiles.map((file) => [file.path, file.content]),
  );
  const divergenceStep = input.intervention.stepIndex;
  let replayedSteps = 0;
  let interventionApplied = false;

  for (const action of actions) {
    const beforeIntervention = action.stepIndex < divergenceStep;

    if (beforeIntervention && failed.has(action.stepIndex)) {
      continue;
    }

    if (action.stepIndex === divergenceStep) {
      if (input.intervention.kind === "none") {
        if (!failed.has(action.stepIndex)) {
          files.set(action.path, action.content);
        }
        continue;
      }

      if (input.intervention.kind === "action_replacement" && input.replacement != null) {
        if (validPath(input.replacement.path)) {
          files.set(input.replacement.path, input.replacement.content);
          interventionApplied = true;
        }
        replayedSteps += 1;
        continue;
      }

      // retry_policy / stop_policy: write the recorded action that failed.
      files.set(action.path, action.content);
      replayedSteps += 1;
      continue;
    }

    if (action.stepIndex > divergenceStep) {
      if (failed.has(action.stepIndex) && input.intervention.kind !== "stop_policy") {
        continue;
      }

      files.set(action.path, action.content);
      replayedSteps += 1;
      continue;
    }

    files.set(action.path, action.content);
  }

  if (
    !interventionApplied &&
    input.intervention.kind === "action_replacement" &&
    input.replacement != null &&
    validPath(input.replacement.path)
  ) {
    files.set(input.replacement.path, input.replacement.content);
    replayedSteps += 1;
  }

  const projectFiles = [...files.entries()].map(([path, content]) => ({ path, content }));
  const evaluation = evaluateRepository({
    task: input.task,
    files: normalizeProjectFiles(projectFiles),
    adapterVersion: input.adapterVersion ?? "1.0.0",
  });
  const passed = evaluation.score.overall >= passThreshold;

  const outcome = CounterfactualOutcomeSchema.parse({
    overall: evaluation.score.overall,
    passed,
    exitReason: "completed",
    divergenceStep,
    replayedSteps,
    passThreshold,
    sufficient: passed,
  });

  return { outcome, files: projectFiles };
}

/** Replays with no intervention; used by the invariant test. */
export function replayBaseline(
  input: Omit<ReplayInput, "intervention">,
): CounterfactualOutcome {
  return replay({
    ...input,
    intervention: { kind: "none", stepIndex: 1, summary: "no intervention" },
  }).outcome;
}
