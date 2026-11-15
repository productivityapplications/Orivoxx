import type { ProjectFile } from "@orivoxx/core";
import {
  DiffSummarySchema,
  RESULT_LIMITS,
  type DiffFile,
  type DiffSummary,
} from "@orivoxx/results";

import type { CapturedFile } from "./contracts.js";

export const DIFF_DEFAULTS = {
  maxBytes: RESULT_LIMITS.maxDiffBytes,
  maxFiles: 120,
  maxLinesPerFile: 400,
} as const;

export interface ProducedDiffOptions {
  maxBytes?: number;
  maxFiles?: number;
  maxLinesPerFile?: number;
}

interface Side {
  path: string;
  lines: string[];
}

function splitLines(content: string): string[] {
  const normalized = content.replace(/\r\n?/g, "\n");

  if (normalized.length === 0) {
    return [];
  }

  const lines = normalized.split("\n");

  if (lines.at(-1) === "") {
    lines.pop();
  }

  return lines;
}

/**
 * Longest-common-subsequence table, bounded by the caller's line cap. Returns
 * the edit script as `equal | delete | insert` operations.
 */
function editScript(
  left: readonly string[],
  right: readonly string[],
): ("equal" | "delete" | "insert")[] {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const table = new Uint32Array(rows * columns);

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      table[row * columns + column] =
        left[row - 1] === right[column - 1]
          ? (table[(row - 1) * columns + column - 1] ?? 0) + 1
          : Math.max(
              table[(row - 1) * columns + column] ?? 0,
              table[row * columns + column - 1] ?? 0,
            );
    }
  }

  const script: ("equal" | "delete" | "insert")[] = [];
  let row = left.length;
  let column = right.length;

  while (row > 0 || column > 0) {
    if (
      row > 0 &&
      column > 0 &&
      left[row - 1] === right[column - 1] &&
      table[row * columns + column] === (table[(row - 1) * columns + column - 1] ?? 0) + 1
    ) {
      script.push("equal");
      row -= 1;
      column -= 1;
      continue;
    }

    const above = row > 0 ? (table[(row - 1) * columns + column] ?? 0) : -1;
    const leftCell = column > 0 ? (table[row * columns + column - 1] ?? 0) : -1;

    if (row > 0 && above >= leftCell) {
      script.push("delete");
      row -= 1;
    } else {
      script.push("insert");
      column -= 1;
    }
  }

  return script.reverse();
}

function countAddedRemoved(
  script: readonly ("equal" | "delete" | "insert")[],
): { added: number; removed: number } {
  let added = 0;
  let removed = 0;

  for (const operation of script) {
    if (operation === "insert") {
      added += 1;
    } else if (operation === "delete") {
      removed += 1;
    }
  }

  return { added, removed };
}

function renderFile(left: Side | null, right: Side | null): {
  text: string;
  added: number;
  removed: number;
  truncated: boolean;
} {
  const leftLines = left?.lines ?? [];
  const rightLines = right?.lines ?? [];
  const script = editScript(leftLines, rightLines);
  const counts = countAddedRemoved(script);
  const header = [
    `--- ${left === null ? "/dev/null" : `a/${left.path}`}`,
    `+++ ${right === null ? "/dev/null" : `b/${right.path}`}`,
    `@@ -${leftLines.length === 0 ? 0 : 1},${leftLines.length} +${
      rightLines.length === 0 ? 0 : 1
    },${rightLines.length} @@`,
  ];
  const body: string[] = [];
  let lineCursor = 0;
  let columnCursor = 0;

  for (const operation of script) {
    if (operation === "equal") {
      body.push(` ${leftLines[lineCursor] ?? ""}`);
      lineCursor += 1;
      columnCursor += 1;
      continue;
    }

    if (operation === "delete") {
      body.push(`-${leftLines[lineCursor] ?? ""}`);
      lineCursor += 1;
      continue;
    }

    body.push(`+${rightLines[columnCursor] ?? ""}`);
    columnCursor += 1;
  }

  return {
    text: `${header.join("\n")}\n${body.map((line) => `${line}\n`).join("")}`,
    added: counts.added,
    removed: counts.removed,
    truncated: false,
  };
}

/**
 * Builds a bounded unified diff between the task's starting repository and the
 * captured produced repository. Only text hunks are stored; the function never
 * writes an artifact and never executes anything.
 */
export function buildProducedDiff(
  starting: readonly ProjectFile[],
  produced: readonly CapturedFile[],
  options: ProducedDiffOptions = {},
): DiffSummary {
  const maxBytes = options.maxBytes ?? DIFF_DEFAULTS.maxBytes;
  const maxFiles = options.maxFiles ?? DIFF_DEFAULTS.maxFiles;
  const maxLinesPerFile = options.maxLinesPerFile ?? DIFF_DEFAULTS.maxLinesPerFile;
  const before = new Map<string, Side>();

  for (const file of starting) {
    before.set(file.path, { path: file.path, lines: splitLines(file.content) });
  }

  const after = new Map<string, Side>();

  for (const file of produced) {
    after.set(file.path, { path: file.path, lines: splitLines(file.content) });
  }

  const changed: { left: Side; right: Side }[] = [];
  const added: Side[] = [];
  const removed: Side[] = [];
  let totalAddedLines = 0;
  let totalRemovedLines = 0;

  for (const [path, right] of after) {
    const left = before.get(path);

    if (left === undefined) {
      added.push(right);
      totalAddedLines += right.lines.length;
      continue;
    }

    const leftText = left.lines.join("\n");
    const rightText = right.lines.join("\n");

    if (leftText !== rightText) {
      changed.push({ left, right });
      const counts = countAddedRemoved(editScript(left.lines, right.lines));

      totalAddedLines += counts.added;
      totalRemovedLines += counts.removed;
    }
  }

  for (const [path, left] of before) {
    if (!after.has(path)) {
      removed.push(left);
      totalRemovedLines += left.lines.length;
    }
  }

  changed.sort((one, two) => (one.right.path < two.right.path ? -1 : 1));
  added.sort((one, two) => (one.path < two.path ? -1 : 1));
  removed.sort((one, two) => (one.path < two.path ? -1 : 1));

  const files: DiffFile[] = [];
  const hunks: string[] = [];
  let bytes = 0;
  let truncated = false;

  const consider = (
    path: string,
    status: DiffFile["status"],
    left: Side | null,
    right: Side | null,
  ): boolean => {
    if (files.length >= maxFiles) {
      truncated = true;
      return false;
    }

    const oversized =
      (left !== null && left.lines.length > maxLinesPerFile) ||
      (right !== null && right.lines.length > maxLinesPerFile);
    const rendered = renderFile(
      oversized && left !== null
        ? { path: left.path, lines: left.lines.slice(0, maxLinesPerFile) }
        : left,
      oversized && right !== null
        ? { path: right.path, lines: right.lines.slice(0, maxLinesPerFile) }
        : right,
    );

    if (bytes + rendered.text.length > maxBytes) {
      truncated = true;
      return false;
    }

    bytes += rendered.text.length;
    hunks.push(rendered.text);
    files.push({
      path,
      status,
      addedLines: rendered.added,
      removedLines: rendered.removed,
    });

    if (oversized) {
      truncated = true;
    }

    return true;
  };

  for (const entry of changed) {
    consider(entry.right.path, "changed", entry.left, entry.right);
  }

  for (const entry of added) {
    consider(entry.path, "added", null, entry);
  }

  for (const entry of removed) {
    consider(entry.path, "removed", entry, null);
  }

  const diff: DiffSummary = {
    text: hunks.join(""),
    truncated,
    addedFiles: added.length,
    removedFiles: removed.length,
    changedFiles: changed.length,
    totalAddedLines,
    totalRemovedLines,
    files,
  };

  return DiffSummarySchema.parse(diff);
}
