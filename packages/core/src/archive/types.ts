export const MAX_COMPRESSED_BYTES = 3_145_728;
export const MAX_EXPANDED_TOTAL_BYTES = 10_485_760;
export const MAX_ENTRY_COUNT = 300;
export const MAX_ELIGIBLE_FILE_BYTES = 307_200;
export const MAX_ELIGIBLE_AGGREGATE_TEXT = 2_097_152;

export const ARCHIVE_ERROR_CODES = [
  "invalid_zip",
  "compressed_size_exceeded",
  "expanded_size_exceeded",
  "entry_count_exceeded",
  "entry_size_exceeded",
  "traversal_path",
  "absolute_path",
  "drive_path",
  "nul_in_path",
  "duplicate_path",
  "symlink_entry",
  "invalid_entry_metadata",
  "no_eligible_files",
  "aggregate_text_exceeded",
] as const;

export type ArchiveErrorCode = (typeof ARCHIVE_ERROR_CODES)[number];

export interface NormalizedFile {
  path: string;
  bytes: Uint8Array;
  content: string;
  lineCount: number;
  fingerprint: string;
  language: string;
  redacted: boolean;
}

export interface ArchiveError {
  code: ArchiveErrorCode;
  message: string;
  detail?: {
    path?: string;
    byteSize?: number;
  };
}

export type ArchiveResult =
  | { ok: true; files: NormalizedFile[]; warnings: string[] }
  | { ok: false; error: ArchiveError };

export interface RedactionResult {
  content: string;
  redactionCount: number;
  categories: string[];
}
