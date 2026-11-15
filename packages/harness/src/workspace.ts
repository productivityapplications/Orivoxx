import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";

import { validateEntryPath, type ProjectFile } from "@orivoxx/core";

import { HarnessError } from "./errors.js";

const WORKSPACE_PREFIX = "orivoxx-run-";

function assertInside(root: string, candidate: string): void {
  if (candidate !== root && !candidate.startsWith(root + sep)) {
    throw new HarnessError(
      "unsafe_path",
      "A project file path escapes the run workspace.",
      candidate,
    );
  }
}

function targetPath(workspace: string, rawPath: string): string {
  const validation = validateEntryPath(rawPath);

  if (!validation.ok) {
    throw new HarnessError(
      "unsafe_path",
      "A project file path is unsafe.",
      `${rawPath}: ${validation.code}`,
    );
  }

  const target = resolve(workspace, validation.path);
  assertInside(workspace, target);

  return target;
}

export async function createRunWorkspace(parent?: string): Promise<string> {
  const root = resolve(parent ?? tmpdir());

  await mkdir(root, { recursive: true });

  return mkdtemp(join(root, WORKSPACE_PREFIX));
}

export async function assertEmptyDirectory(directory: string): Promise<void> {
  const resolved = resolve(directory);
  const entries = await readdir(resolved);

  if (entries.length > 0) {
    throw new HarnessError(
      "workspace_not_empty",
      "The run workspace must be empty before a run starts.",
      resolved,
    );
  }
}

export interface WriteProjectFilesOptions {
  overwrite?: boolean;
}

export async function writeProjectFiles(
  workspace: string,
  files: readonly ProjectFile[],
  options: WriteProjectFilesOptions = {},
): Promise<string[]> {
  const root = resolve(workspace);
  const seen = new Set<string>();
  const written: string[] = [];

  for (const file of files) {
    const target = targetPath(root, file.path);

    if (seen.has(target)) {
      throw new HarnessError("duplicate_path", "Duplicate project file path.", file.path);
    }

    seen.add(target);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, {
      encoding: "utf8",
      flag: options.overwrite === true ? "w" : "wx",
    });
    written.push(target);
  }

  return written;
}

export async function removeRunWorkspace(directory: string): Promise<void> {
  const resolved = resolve(directory);

  if (!isAbsolute(directory) || !basename(resolved).startsWith(WORKSPACE_PREFIX)) {
    throw new HarnessError(
      "invalid_workspace",
      "Refusing to remove a directory that is not a harness run workspace.",
      resolved,
    );
  }

  if (resolved === "/" || resolved === resolve(tmpdir())) {
    throw new HarnessError(
      "invalid_workspace",
      "Refusing to remove a shared directory.",
      resolved,
    );
  }

  await rm(resolved, { recursive: true, force: true });
}
