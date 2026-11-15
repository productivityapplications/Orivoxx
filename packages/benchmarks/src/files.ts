import { createHash } from "node:crypto";

import {
  classifyPathExclusion,
  detectLanguage,
  redactSecrets,
  validateEntryPath,
  type NormalizedFile,
  type ProjectFile,
} from "@orivoxx/core";

export class ProjectFileError extends Error {
  readonly code = "invalid_project_file";

  constructor(message: string) {
    super(message);
    this.name = "ProjectFileError";
  }
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

export function normalizeProjectFiles(files: readonly ProjectFile[]): NormalizedFile[] {
  const encoder = new TextEncoder();
  const seen = new Set<string>();
  const normalized: NormalizedFile[] = [];

  for (const file of files) {
    const validation = validateEntryPath(file.path);

    if (!validation.ok) {
      throw new ProjectFileError(
        `Unsafe project file path "${file.path}" (${validation.code}).`,
      );
    }

    const path = validation.path;

    if (seen.has(path)) {
      throw new ProjectFileError(`Duplicate project file path "${path}".`);
    }

    seen.add(path);

    if (classifyPathExclusion(path) !== null) {
      continue;
    }

    const content = file.content.replace(/\r\n?/g, "\n");
    const redaction = redactSecrets(content);

    normalized.push({
      path,
      bytes: encoder.encode(content),
      content: redaction.content,
      lineCount: countLines(content),
      fingerprint: createHash("sha256").update(content, "utf8").digest("hex"),
      language: detectLanguage(path),
      redacted: redaction.redactionCount > 0,
    });
  }

  return normalized.sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  );
}
