import { readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import { CURATED_REAL_TASKS } from "./real.js";
import { RealTaskSchema, type RealTask } from "./real.js";

export type RemoteTaskReader = (id: string) => Promise<unknown | null>;

export interface LoadRealTaskOptions {
  cwd?: string;
  remote?: RemoteTaskReader;
  curated?: readonly RealTask[];
}

function diskCandidates(id: string, cwd: string): string[] {
  return [
    join(cwd, "data", "tasks", `${id}.json`),
    join(cwd, "..", "data", "tasks", `${id}.json`),
    join(cwd, "..", "..", "data", "tasks", `${id}.json`),
  ];
}

/**
 * Loads a real task from disk, then the remote store, then the curated bundle.
 * A malformed higher-priority document is ignored with a safe error code.
 */
export async function loadRealTask(
  id: string,
  options: LoadRealTaskOptions = {},
): Promise<RealTask | null> {
  const cwd = options.cwd ?? process.cwd();
  const curated = options.curated ?? CURATED_REAL_TASKS;

  for (const candidate of diskCandidates(id, cwd)) {
    try {
      const raw = await readFile(isAbsolute(candidate) ? candidate : resolve(candidate), "utf8");
      const parsed = RealTaskSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch {
      // Try the next source.
    }
  }

  if (options.remote !== undefined) {
    try {
      const remote = await options.remote(id);
      const parsed = RealTaskSchema.safeParse(remote);
      if (parsed.success) return parsed.data;
    } catch {
      // Fall through to the curated bundle.
    }
  }

  return curated.find((task) => task.id === id) ?? null;
}

export async function listRealTasks(options: LoadRealTaskOptions = {}): Promise<RealTask[]> {
  return [...(options.curated ?? CURATED_REAL_TASKS)];
}
