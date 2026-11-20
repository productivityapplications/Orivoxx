import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import { promisify } from "node:util";

import type { ProjectFile } from "@orivoxx/core";
import type { RealTask } from "@orivoxx/benchmarks";

import {
  HARNESS_LIMITS,
  type AdapterRunInput,
  type AgentAdapter,
} from "./contracts.js";
import { HarnessError } from "./errors.js";

const execFile = promisify(execFileCallback);
const SKIP_DIRECTORIES = new Set([".git", "node_modules", "dist", "build", "coverage", ".next"]);
const TEXT_EXTENSIONS = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".json", ".md", ".txt", ".py", ".toml",
  ".yml", ".yaml", ".css", ".html", ".sh", ".cfg", ".ini", ".LICENSE", "LICENSE",
]);

export interface ClonedRepository {
  files: ProjectFile[];
  directory: string;
}

function isTextPath(path: string): boolean {
  if (path === "LICENSE" || path.endsWith("/LICENSE")) return true;
  const index = path.lastIndexOf(".");
  return index >= 0 && TEXT_EXTENSIONS.has(path.slice(index).toLowerCase());
}

async function collect(directory: string): Promise<ProjectFile[]> {
  const files: ProjectFile[] = [];
  let totalBytes = 0;

  async function walk(path: string): Promise<void> {
    for (const name of await readdir(path)) {
      if (SKIP_DIRECTORIES.has(name)) continue;
      const absolute = join(path, name);
      const info = await stat(absolute);
      if (info.isDirectory()) {
        await walk(absolute);
        continue;
      }
      const relativePath = relative(directory, absolute).replaceAll("\\", "/");
      if (!isTextPath(relativePath) || info.size > HARNESS_LIMITS.maxFileBytes) continue;
      if (files.length >= HARNESS_LIMITS.maxFiles || totalBytes + info.size > HARNESS_LIMITS.maxAggregateBytes) {
        throw new HarnessError("artifact_aggregate_exceeded", "The repository exceeds the workspace budget.");
      }
      const content = await readFile(absolute, "utf8");
      if (content.includes("\0")) continue;
      files.push({ path: relativePath, content });
      totalBytes += info.size;
    }
  }

  await walk(directory);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

/**
 * Clones on the host (network is not available in the sandbox), checks out the
 * exact base commit, strips .git, and returns bounded text files for the
 * sandbox workspace. No repository code is executed here.
 */
export async function cloneTaskRepository(task: RealTask): Promise<ClonedRepository> {
  const directory = await mkdtemp(join(tmpdir(), "orivoxx-clone-"));

  try {
    await execFile("git", ["init", "-q", directory], { timeout: 30_000 });
    await execFile("git", ["-C", directory, "remote", "add", "origin", task.repoUrl], { timeout: 30_000 });
    await execFile(
      "git",
      ["-C", directory, "fetch", "--depth", "1", "origin", task.baseCommit],
      { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 },
    );
    await execFile("git", ["-C", directory, "checkout", "--detach", "FETCH_HEAD"], { timeout: 30_000 });
    await rm(join(directory, ".git"), { recursive: true, force: true });
    const files = await collect(directory);
    return { files, directory };
  } catch (error) {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    throw new HarnessError(
      "invalid_real_task",
      "The repository could not be cloned at the requested commit.",
      error instanceof Error ? error.message.slice(0, 300) : undefined,
    );
  }
}

export function buildRealRunInput(
  task: RealTask,
  startingFiles: readonly ProjectFile[],
  adapter: AgentAdapter,
  options: {
    timeLimitSeconds?: number;
    maxSteps?: number;
    chaos?: AdapterRunInput["chaos"];
  } = {},
): AdapterRunInput {
  return {
    schemaVersion: "1.0.0",
    task: {
      id: task.id,
      version: task.version,
      rulesetVersion: "1.0.0",
      scoringConfigVersion: "1.0.0",
    },
    startingFiles: [
      ...startingFiles,
      {
        path: ".orivoxx/issue.md",
        content: `# Issue\n\n${task.issueText}\n\nRepository: ${task.repoUrl}\nBase commit: ${task.baseCommit}\n`,
      },
    ],
    limits: {
      timeLimitSeconds: options.timeLimitSeconds ?? 900,
      maxSteps: options.maxSteps ?? 40,
      maxOutputBytes: 1_048_576,
    },
    network: "model-proxy",
    model: adapter.model,
    chaos: options.chaos ?? "none",
  };
}

export async function cleanupClone(directory: string): Promise<void> {
  if (!basename(directory).startsWith("orivoxx-clone-")) return;
  await rm(directory, { recursive: true, force: true }).catch(() => undefined);
}
