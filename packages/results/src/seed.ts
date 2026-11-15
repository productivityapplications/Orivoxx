import {
  BenchmarkResultSchema,
  RESULT_LIMITS,
  type BenchmarkResult,
  type LeaderboardEntry,
} from "./contracts.js";
import { toLeaderboardEntry } from "./contracts.js";
import {
  rankLeaderboard,
  ResultStoreError,
  type ResultQuery,
  type ResultStore,
} from "./store.js";

/**
 * Bundled read-only results. They keep the deployed app useful when the shared
 * store is missing or unreachable, and every row is a real recorded run rather
 * than a hand-written number.
 */
export class SeedResultStore implements ResultStore {
  readonly kind = "seed" as const;
  readonly diagnostics: string[] = [];
  readonly #results: BenchmarkResult[];

  constructor(results: readonly BenchmarkResult[], diagnostics: string[] = []) {
    this.#results = [...results];
    this.diagnostics.push(...diagnostics);
  }

  static parse(raw: string | unknown): SeedResultStore {
    const diagnostics: string[] = [];
    let document: unknown = raw;

    if (typeof raw === "string") {
      try {
        document = JSON.parse(raw);
      } catch {
        throw new ResultStoreError("invalid_stored_result", "Seed results are not valid JSON.");
      }
    }

    if (
      document === null ||
      typeof document !== "object" ||
      !("results" in document) ||
      !Array.isArray((document as { results: unknown }).results)
    ) {
      throw new ResultStoreError(
        "invalid_stored_result",
        "Seed results must be an object with a results array.",
      );
    }

    const rows = (document as { results: unknown[] }).results;

    if (rows.length > RESULT_LIMITS.maxResultsPerRead) {
      throw new ResultStoreError(
        "invalid_stored_result",
        `Seed results exceed the ${RESULT_LIMITS.maxResultsPerRead} row limit.`,
      );
    }

    const results: BenchmarkResult[] = [];

    for (const [index, row] of rows.entries()) {
      const parsed = BenchmarkResultSchema.safeParse(row);

      if (!parsed.success) {
        diagnostics.push(`seed_res_${index}_invalid`);
        continue;
      }

      results.push(parsed.data);
    }

    return new SeedResultStore(results, diagnostics);
  }

  async append(): Promise<void> {
    throw new ResultStoreError(
      "write_failed",
      "Seed results are read-only. Record a run to add a result.",
    );
  }

  async get(resultId: string): Promise<BenchmarkResult | null> {
    return this.#results.find((result) => result.resultId === resultId) ?? null;
  }

  async list(query: ResultQuery = {}): Promise<LeaderboardEntry[]> {
    return rankLeaderboard(this.#results.map(toLeaderboardEntry), query.limit);
  }

  async listByTask(
    taskId: string,
    query: ResultQuery = {},
  ): Promise<LeaderboardEntry[]> {
    return rankLeaderboard(
      this.#results
        .filter((result) => result.taskId === taskId)
        .map(toLeaderboardEntry),
      query.limit,
    );
  }
}

export function seedEntryCount(store: SeedResultStore): number {
  return store.diagnostics.length === 0 ? 0 : store.diagnostics.length;
}
