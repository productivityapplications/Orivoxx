import type { BenchmarkResult, LeaderboardEntry } from "./contracts.js";
import { RESULT_LIMITS } from "./contracts.js";

export type ResultStoreKind = "local" | "upstash" | "seed" | "memory";

export type ResultStoreErrorCode =
  | "duplicate_result"
  | "invalid_stored_result"
  | "store_unavailable"
  | "read_failed"
  | "write_failed";

export class ResultStoreError extends Error {
  readonly code: ResultStoreErrorCode;
  readonly detail?: string;

  constructor(code: ResultStoreErrorCode, message: string, detail?: string) {
    super(message);
    this.name = "ResultStoreError";
    this.code = code;
    this.detail = detail;
  }
}

export interface ResultQuery {
  limit?: number;
}

/**
 * Append-only result storage. There is deliberately no update or delete: a
 * stored scorecard is immutable evidence, and a re-run produces a new row.
 */
export interface ResultStore {
  readonly kind: ResultStoreKind;
  append(result: BenchmarkResult): Promise<void>;
  get(resultId: string): Promise<BenchmarkResult | null>;
  list(query?: ResultQuery): Promise<LeaderboardEntry[]>;
  listByTask(taskId: string, query?: ResultQuery): Promise<LeaderboardEntry[]>;
}

export function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return RESULT_LIMITS.defaultResultsPerRead;
  }

  return Math.min(
    RESULT_LIMITS.maxResultsPerRead,
    Math.max(1, Math.trunc(limit)),
  );
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Leaderboard order is total and stable: higher score first, then the earlier
 * result, then the result id. No hidden insertion-order dependence.
 */
export function compareLeaderboardEntries(
  left: LeaderboardEntry,
  right: LeaderboardEntry,
): number {
  if (left.overall !== right.overall) {
    return right.overall - left.overall;
  }

  const leftTime = Date.parse(left.createdAt);
  const rightTime = Date.parse(right.createdAt);

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return compareStrings(left.resultId, right.resultId);
}

export function sortLeaderboard(
  entries: readonly LeaderboardEntry[],
): LeaderboardEntry[] {
  return [...entries].sort(compareLeaderboardEntries);
}

export function rankLeaderboard(
  entries: readonly LeaderboardEntry[],
  limit: number | undefined,
): LeaderboardEntry[] {
  return sortLeaderboard(entries).slice(0, clampLimit(limit));
}
