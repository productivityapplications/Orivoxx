export const HARNESS_ERROR_CODES = [
  "invalid_run_input",
  "invalid_run_output",
  "invalid_workspace",
  "workspace_not_empty",
  "unsafe_path",
  "duplicate_path",
  "symlink_entry",
  "artifact_file_count_exceeded",
  "artifact_aggregate_exceeded",
  "no_eligible_files",
  "executor_required",
  "workspace_io_error",
] as const;

export type HarnessErrorCode = (typeof HARNESS_ERROR_CODES)[number];

export class HarnessError extends Error {
  readonly code: HarnessErrorCode;
  readonly detail?: string;

  constructor(code: HarnessErrorCode, message: string, detail?: string) {
    super(message);
    this.name = "HarnessError";
    this.code = code;
    this.detail = detail;
  }
}

export function isHarnessError(value: unknown): value is HarnessError {
  return value instanceof HarnessError;
}
