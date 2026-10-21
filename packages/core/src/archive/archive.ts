import { createHash } from "node:crypto";

import { unzipSync, type UnzipFileInfo } from "fflate";

import {
  crc32,
  isSymlinkEntry,
  scanCentralDirectory,
  type CentralDirectoryEntry,
} from "./central-directory.js";
import {
  classifyPathExclusion,
  detectLanguage,
  isDirectoryEntry,
  normalizeEntryPath,
  validateEntryPath,
} from "./paths.js";
import { redactSecrets } from "./redact.js";
import {
  MAX_COMPRESSED_BYTES,
  MAX_ELIGIBLE_AGGREGATE_TEXT,
  MAX_ELIGIBLE_FILE_BYTES,
  MAX_ENTRY_COUNT,
  MAX_EXPANDED_TOTAL_BYTES,
  type ArchiveError,
  type ArchiveErrorCode,
  type ArchiveResult,
  type NormalizedFile,
} from "./types.js";

const BINARY_NUL_SCAN_BYTES = 8_192;
const SUPPORTED_COMPRESSION_METHODS = new Set([0, 8]);

interface EntryMetadata {
  info: UnzipFileInfo;
  central: CentralDirectoryEntry;
  path: string;
  directory: boolean;
}

function failure(
  code: ArchiveErrorCode,
  message: string,
  detail?: ArchiveError["detail"],
): { ok: false; error: ArchiveError } {
  return {
    ok: false,
    error: detail === undefined ? { code, message } : { code, message, detail },
  };
}

function collectEntryMetadata(bytes: Uint8Array): UnzipFileInfo[] {
  const entries: UnzipFileInfo[] = [];

  unzipSync(bytes, {
    filter: (info) => {
      entries.push({
        name: info.name,
        size: info.size,
        originalSize: info.originalSize,
        compression: info.compression,
      });
      return false;
    },
  });

  return entries;
}

function hasNulByteInFirstBytes(bytes: Uint8Array, limit: number): boolean {
  const end = Math.min(bytes.length, limit);

  for (let index = 0; index < end; index += 1) {
    if (bytes[index] === 0) {
      return true;
    }
  }

  return false;
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

function fingerprintText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function intakeArchive(input: ArrayBuffer | Uint8Array): ArchiveResult {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  if (bytes.byteLength > MAX_COMPRESSED_BYTES) {
    return failure(
      "compressed_size_exceeded",
      "The compressed archive exceeds the 3 MiB limit.",
      { byteSize: bytes.byteLength },
    );
  }

  if (bytes.byteLength === 0) {
    return failure("invalid_zip", "The uploaded file is not a valid ZIP archive.");
  }

  const centralScan = scanCentralDirectory(bytes, MAX_ENTRY_COUNT);

  if (!centralScan.ok) {
    if (centralScan.code === "entry_count_exceeded") {
      return failure(
        "entry_count_exceeded",
        `The archive contains more than ${MAX_ENTRY_COUNT} entries.`,
      );
    }

    return failure(
      centralScan.code,
      centralScan.code === "invalid_zip"
        ? "The uploaded file is not a valid ZIP archive."
        : "The archive contains invalid entry metadata.",
    );
  }

  let metadataEntries: UnzipFileInfo[];

  try {
    metadataEntries = collectEntryMetadata(bytes);
  } catch {
    return failure("invalid_zip", "The uploaded file is not a valid ZIP archive.");
  }

  if (metadataEntries.length !== centralScan.entries.length) {
    return failure("invalid_entry_metadata", "The archive contains invalid entry metadata.");
  }

  const warnings: string[] = [];
  const seenPaths = new Set<string>();
  const fileEntries: EntryMetadata[] = [];

  for (let index = 0; index < metadataEntries.length; index += 1) {
    const info = metadataEntries[index];
    const central = centralScan.entries[index];

    if (info === undefined || central === undefined) {
      return failure("invalid_entry_metadata", "The archive contains invalid entry metadata.");
    }

    const validation = validateEntryPath(info.name);

    if (!validation.ok) {
      return failure(validation.code, "The archive contains an unsafe entry path.", {
        path: validation.path,
      });
    }

    const path = validation.path;
    const directory = isDirectoryEntry(info.name);

    if (
      !Number.isInteger(info.size) ||
      info.size < 0 ||
      !Number.isInteger(info.originalSize) ||
      info.originalSize < 0
    ) {
      return failure("invalid_entry_metadata", "The archive contains invalid entry metadata.", {
        path,
      });
    }

    if ((central.flags & 0x0001) !== 0) {
      return failure("invalid_entry_metadata", "Encrypted archive entries are not supported.", {
        path,
      });
    }

    if (central.compressedSize !== 0xffffffff && central.compressedSize !== info.size) {
      return failure("invalid_entry_metadata", "The archive contains inconsistent entry metadata.", {
        path,
      });
    }

    if (
      central.uncompressedSize !== 0xffffffff &&
      central.uncompressedSize !== info.originalSize
    ) {
      return failure("invalid_entry_metadata", "The archive contains inconsistent entry metadata.", {
        path,
      });
    }

    if (isSymlinkEntry(central)) {
      return failure("symlink_entry", "The archive contains a symbolic link entry.", { path });
    }

    if (seenPaths.has(path)) {
      return failure("duplicate_path", "The archive contains duplicate normalized paths.", {
        path,
      });
    }

    seenPaths.add(path);

    if (!directory) {
      fileEntries.push({
        info,
        central,
        path,
        directory,
      });
    }
  }

  const candidates: EntryMetadata[] = [];

  for (const entry of fileEntries) {
    const exclusionReason = classifyPathExclusion(entry.path);

    if (exclusionReason !== null) {
      warnings.push(`excluded: ${entry.path} (reason: ${exclusionReason})`);
      continue;
    }

    if (entry.info.originalSize > MAX_ELIGIBLE_FILE_BYTES) {
      warnings.push(
        `excluded: ${entry.path} (reason: oversized_eligible_file, bytes: ${entry.info.originalSize})`,
      );
      continue;
    }

    if (!SUPPORTED_COMPRESSION_METHODS.has(entry.info.compression)) {
      return failure(
        "invalid_entry_metadata",
        "The archive uses an unsupported compression method.",
        { path: entry.path },
      );
    }

    candidates.push(entry);
  }

  if (candidates.length === 0) {
    return failure("no_eligible_files", "The archive contains no eligible text files.");
  }

  const expandedTotal = candidates.reduce((total, entry) => total + entry.info.originalSize, 0);

  if (expandedTotal > MAX_EXPANDED_TOTAL_BYTES) {
    return failure(
      "expanded_size_exceeded",
      "The archive expands beyond the 10 MiB limit.",
      { byteSize: expandedTotal },
    );
  }

  const sortedCandidates = [...candidates].sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  );

  const includedEntries: EntryMetadata[] = [];
  let aggregateBytes = 0;
  let aggregateBudgetExhausted = false;

  for (const entry of sortedCandidates) {
    if (
      !aggregateBudgetExhausted &&
      aggregateBytes + entry.info.originalSize <= MAX_ELIGIBLE_AGGREGATE_TEXT
    ) {
      aggregateBytes += entry.info.originalSize;
      includedEntries.push(entry);
    } else {
      aggregateBudgetExhausted = true;
      warnings.push(`excluded: ${entry.path} (reason: aggregate_text_exceeded)`);
    }
  }

  const includedByPath = new Map(includedEntries.map((entry) => [entry.path, entry]));
  let unzipped: Record<string, Uint8Array>;

  try {
    unzipped = unzipSync(bytes, {
      filter: (info) => includedByPath.has(normalizeEntryPath(info.name)),
    });
  } catch {
    return failure(
      "invalid_entry_metadata",
      "The archive contains entry data that could not be decompressed.",
    );
  }

  const decompressedByPath = new Map<string, Uint8Array>();

  for (const [name, data] of Object.entries(unzipped)) {
    decompressedByPath.set(normalizeEntryPath(name), data);
  }

  const decoder = new TextDecoder("utf-8", { fatal: true });
  const files: NormalizedFile[] = [];

  for (const entry of includedEntries) {
    const data = decompressedByPath.get(entry.path);

    if (data === undefined || data.length !== entry.info.originalSize) {
      return failure("invalid_entry_metadata", "The archive contains invalid entry data.", {
        path: entry.path,
      });
    }

    if (crc32(data) !== entry.central.crc32) {
      return failure("invalid_entry_metadata", "The archive contains invalid entry data.", {
        path: entry.path,
      });
    }

    if (hasNulByteInFirstBytes(data, BINARY_NUL_SCAN_BYTES)) {
      warnings.push(`excluded: ${entry.path} (reason: binary_content)`);
      continue;
    }

    let decoded: string;

    try {
      decoded = decoder.decode(data);
    } catch {
      warnings.push(`excluded: ${entry.path} (reason: utf8_decode_failed)`);
      continue;
    }

    const normalizedText = decoded.replace(/\r\n?/g, "\n");
    const fingerprint = fingerprintText(normalizedText);
    const lineCount = countLines(normalizedText);
    const language = detectLanguage(entry.path);
    const redaction = redactSecrets(normalizedText);

    files.push({
      path: entry.path,
      bytes: data,
      content: redaction.content,
      lineCount,
      fingerprint,
      language,
      redacted: redaction.redactionCount > 0,
    });
  }

  if (files.length === 0) {
    return failure("no_eligible_files", "The archive contains no eligible text files.");
  }

  return { ok: true, files, warnings };
}
