import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

import {
  classifyPathExclusion,
  computeRepositoryFingerprint,
  detectLanguage,
  redactSecrets,
  validateEntryPath,
  type NormalizedFile,
} from "@orivoxx/core";

import {
  HARNESS_LIMITS,
  type ArtifactStats,
  type CapturedFile,
} from "./contracts.js";
import { HarnessError } from "./errors.js";

const BINARY_SCAN_BYTES = 8_192;

export interface CaptureOptions {
  maxFiles?: number;
  maxFileBytes?: number;
  maxAggregateBytes?: number;
  maxWarnings?: number;
}

export interface CaptureResult {
  files: CapturedFile[];
  repositoryFingerprint: string;
  stats: ArtifactStats;
  warnings: string[];
}

interface ResolvedLimits {
  maxFiles: number;
  maxFileBytes: number;
  maxAggregateBytes: number;
  maxWarnings: number;
}

function resolveLimits(options: CaptureOptions): ResolvedLimits {
  return {
    maxFiles: options.maxFiles ?? HARNESS_LIMITS.maxFiles,
    maxFileBytes: options.maxFileBytes ?? HARNESS_LIMITS.maxFileBytes,
    maxAggregateBytes: options.maxAggregateBytes ?? HARNESS_LIMITS.maxAggregateBytes,
    maxWarnings: options.maxWarnings ?? HARNESS_LIMITS.maxWarnings,
  };
}

function sha256Hex(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function countLines(text: string): number {
  if (text.length === 0) {
    return 0;
  }

  let lines = 1;

  for (const character of text) {
    if (character === "\n") {
      lines += 1;
    }
  }

  return text.endsWith("\n") ? lines - 1 : lines;
}

function containsNul(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.byteLength, BINARY_SCAN_BYTES);

  for (let index = 0; index < limit; index += 1) {
    if (bytes[index] === 0) {
      return true;
    }
  }

  return false;
}

export function fingerprintRepository(
  files: readonly { path: string; fingerprint: string }[],
): string {
  return computeRepositoryFingerprint(files);
}

interface WalkEntry {
  absolutePath: string;
  relativePath: string;
}

async function walk(
  root: string,
  current: string,
  warnings: string[],
  excluded: { count: number },
  maxWarnings: number,
): Promise<WalkEntry[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const files: WalkEntry[] = [];

  for (const entry of entries.sort((left, right) => compareStrings(left.name, right.name))) {
    const absolutePath = join(current, entry.name);
    const relativePath = relative(root, absolutePath).split(sep).join("/");

    if (entry.isSymbolicLink()) {
      throw new HarnessError(
        "symlink_entry",
        "The produced workspace contains a symbolic link.",
        relativePath,
      );
    }

    if (entry.isDirectory()) {
      const exclusion = classifyPathExclusion(relativePath);

      if (exclusion !== null) {
        excluded.count += 1;
        continue;
      }

      files.push(
        ...(await walk(root, absolutePath, warnings, excluded, maxWarnings)),
      );
      continue;
    }

    if (!entry.isFile()) {
      excluded.count += 1;

      if (warnings.length < maxWarnings) {
        warnings.push(`excluded: ${relativePath} (reason: special_file)`);
      }

      continue;
    }

    files.push({ absolutePath, relativePath });
  }

  return files;
}

function normalizeRelativePath(candidate: string): string {
  const validation = validateEntryPath(candidate);

  if (!validation.ok) {
    throw new HarnessError(
      "unsafe_path",
      "The produced workspace contains an unsafe path.",
      candidate,
    );
  }

  return validation.path;
}

export async function captureWorkspace(
  root: string,
  options: CaptureOptions = {},
): Promise<CaptureResult> {
  const limits = resolveLimits(options);
  const resolvedRoot = resolve(root);
  let rootStat;

  try {
    rootStat = await lstat(resolvedRoot);
  } catch {
    throw new HarnessError(
      "invalid_workspace",
      "The capture root does not exist.",
      resolvedRoot,
    );
  }

  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new HarnessError(
      "invalid_workspace",
      "The capture root must be a real directory.",
      resolvedRoot,
    );
  }

  const warnings: string[] = [];
  const excluded = { count: 0 };
  const entries = await walk(
    resolvedRoot,
    resolvedRoot,
    warnings,
    excluded,
    limits.maxWarnings,
  );
  const seen = new Set<string>();
  const files: CapturedFile[] = [];
  let aggregateBytes = 0;
  let redactedFiles = 0;

  for (const entry of entries) {
    const path = normalizeRelativePath(entry.relativePath);

    if (seen.has(path)) {
      throw new HarnessError("duplicate_path", "Duplicate normalized path.", path);
    }

    seen.add(path);

    const exclusion = classifyPathExclusion(path);

    if (exclusion !== null) {
      excluded.count += 1;
      continue;
    }

    const stat = await lstat(entry.absolutePath);

    if (stat.isSymbolicLink()) {
      throw new HarnessError("symlink_entry", "Symbolic link in produced workspace.", path);
    }

    if (!stat.isFile()) {
      excluded.count += 1;
      continue;
    }

    if (stat.size > limits.maxFileBytes) {
      excluded.count += 1;

      if (warnings.length < limits.maxWarnings) {
        warnings.push(`excluded: ${path} (reason: oversized_eligible_file)`);
      }

      continue;
    }

    if (files.length >= limits.maxFiles) {
      throw new HarnessError(
        "artifact_file_count_exceeded",
        `The produced repository exceeds ${limits.maxFiles} files.`,
        path,
      );
    }

    if (aggregateBytes + stat.size > limits.maxAggregateBytes) {
      throw new HarnessError(
        "artifact_aggregate_exceeded",
        `The produced repository exceeds ${limits.maxAggregateBytes} bytes of text.`,
        path,
      );
    }

    const bytes = await readFile(entry.absolutePath);

    if (bytes.byteLength > limits.maxFileBytes) {
      excluded.count += 1;

      if (warnings.length < limits.maxWarnings) {
        warnings.push(`excluded: ${path} (reason: oversized_eligible_file)`);
      }

      continue;
    }

    if (containsNul(bytes)) {
      excluded.count += 1;

      if (warnings.length < limits.maxWarnings) {
        warnings.push(`excluded: ${path} (reason: binary_content)`);
      }

      continue;
    }

    let content: string;

    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      excluded.count += 1;

      if (warnings.length < limits.maxWarnings) {
        warnings.push(`excluded: ${path} (reason: utf8_decode_failed)`);
      }

      continue;
    }

    const normalizedContent = content.replace(/\r\n?/g, "\n");
    const redaction = redactSecrets(normalizedContent);

    if (redaction.redactionCount > 0) {
      redactedFiles += 1;
    }

    aggregateBytes += bytes.byteLength;

    files.push({
      path,
      content: redaction.content,
      byteSize: bytes.byteLength,
      lineCount: countLines(normalizedContent),
      fingerprint: sha256Hex(normalizedContent),
      language: detectLanguage(path),
      redacted: redaction.redactionCount > 0,
    });
  }

  if (files.length === 0) {
    throw new HarnessError(
      "no_eligible_files",
      "The produced workspace contains no eligible text files.",
      resolvedRoot,
    );
  }

  files.sort((left, right) => compareStrings(left.path, right.path));

  return {
    files,
    repositoryFingerprint: fingerprintRepository(files),
    stats: {
      fileCount: files.length,
      totalBytes: aggregateBytes,
      redactedFiles,
      excludedFiles: excluded.count,
    },
    warnings: warnings.slice(0, limits.maxWarnings),
  };
}

export function toNormalizedFiles(files: readonly CapturedFile[]): NormalizedFile[] {
  const encoder = new TextEncoder();

  return files.map((file) => ({
    path: file.path,
    bytes: encoder.encode(file.content),
    content: file.content,
    lineCount: file.lineCount,
    fingerprint: file.fingerprint,
    language: file.language,
    redacted: file.redacted,
  }));
}
