import type { NormalizedFile } from "../archive/types.js";

export interface InventoryFile {
  path: string;
  byteSize: number;
  lineCount: number;
  fingerprint: string;
  language: string;
  redacted: boolean;
}

export interface InventorySummary {
  totalFiles: number;
  totalBytes: number;
  byLanguage: Record<string, number>;
  redactedCount: number;
}

export interface InventoryResult {
  files: InventoryFile[];
  summary: InventorySummary;
  warnings: string[];
}

export function buildInventory(files: NormalizedFile[]): InventoryResult {
  const inventoryFiles: InventoryFile[] = files.map((file) => ({
    path: file.path,
    byteSize: file.bytes.byteLength,
    lineCount: file.lineCount,
    fingerprint: file.fingerprint,
    language: file.language,
    redacted: file.redacted,
  }));

  const byLanguage: Record<string, number> = {};
  let totalBytes = 0;
  let redactedCount = 0;

  for (const file of inventoryFiles) {
    totalBytes += file.byteSize;
    byLanguage[file.language] = (byLanguage[file.language] ?? 0) + 1;

    if (file.redacted) {
      redactedCount += 1;
    }
  }

  return {
    files: inventoryFiles,
    summary: {
      totalFiles: inventoryFiles.length,
      totalBytes,
      byLanguage,
      redactedCount,
    },
    warnings: [],
  };
}
