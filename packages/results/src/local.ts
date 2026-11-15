import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  BenchmarkResultSchema,
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

export interface LocalResultStoreOptions {
  directory: string;
}

const RESULT_FILE_PATTERN = /^res_[a-z0-9]{10,40}\.json$/;

function isMissingFile(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function isExistingFile(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "EEXIST"
  );
}

/**
 * Append-only local store: one immutable JSON file per result under
 * `.data/results`. Writes use `wx`, so the filesystem itself rejects an
 * overwrite and a duplicate id cannot silently replace evidence.
 */
export class LocalResultStore implements ResultStore {
  readonly kind = "local" as const;
  readonly #directory: string;

  constructor(options: LocalResultStoreOptions) {
    this.#directory = resolve(options.directory);
  }

  get directory(): string {
    return this.#directory;
  }

  async append(result: BenchmarkResult): Promise<void> {
    const parsed = BenchmarkResultSchema.safeParse(result);

    if (!parsed.success) {
      throw new ResultStoreError(
        "invalid_stored_result",
        "Refusing to store a result that does not satisfy the result contract.",
        parsed.error.issues.map((issue) => issue.message).join("; "),
      );
    }

    await mkdir(this.#directory, { recursive: true });

    const target = join(this.#directory, `${parsed.data.resultId}.json`);

    try {
      await writeFile(target, `${JSON.stringify(parsed.data, null, 2)}\n`, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
    } catch (error) {
      if (isExistingFile(error)) {
        throw new ResultStoreError(
          "duplicate_result",
          `Result ${parsed.data.resultId} already exists. Results are append-only.`,
        );
      }

      throw new ResultStoreError(
        "write_failed",
        "The result could not be written.",
        error instanceof Error ? error.name : undefined,
      );
    }
  }

  async get(resultId: string): Promise<BenchmarkResult | null> {
    const target = join(this.#directory, `${resultId}.json`);
    let raw: string;

    try {
      raw = await readFile(target, "utf8");
    } catch (error) {
      if (isMissingFile(error)) {
        return null;
      }

      throw new ResultStoreError(
        "read_failed",
        "The result could not be read.",
        error instanceof Error ? error.name : undefined,
      );
    }

    return this.#parse(raw, resultId);
  }

  async list(query: ResultQuery = {}): Promise<LeaderboardEntry[]> {
    return rankLeaderboard(await this.#readAll(), query.limit);
  }

  async listByTask(
    taskId: string,
    query: ResultQuery = {},
  ): Promise<LeaderboardEntry[]> {
    const entries = (await this.#readAll()).filter(
      (entry) => entry.taskId === taskId,
    );

    return rankLeaderboard(entries, query.limit);
  }

  async #readAll(): Promise<LeaderboardEntry[]> {
    let names: string[];

    try {
      names = await readdir(this.#directory);
    } catch (error) {
      if (isMissingFile(error)) {
        return [];
      }

      throw new ResultStoreError(
        "read_failed",
        "The result directory could not be read.",
        error instanceof Error ? error.name : undefined,
      );
    }

    const files = names.filter((name) => RESULT_FILE_PATTERN.test(name)).sort();
    const entries: LeaderboardEntry[] = [];

    for (const name of files) {
      const raw = await readFile(join(this.#directory, name), "utf8");
      const result = this.#parse(raw, name.replace(/\.json$/, ""));

      entries.push(toLeaderboardEntry(result));
    }

    return entries;
  }

  #parse(raw: string, expectedId: string): BenchmarkResult {
    let parsed: BenchmarkResult;

    try {
      parsed = BenchmarkResultSchema.parse(JSON.parse(raw));
    } catch (error) {
      throw new ResultStoreError(
        "invalid_stored_result",
        `Stored result ${expectedId} is invalid.`,
        error instanceof Error ? error.name : undefined,
      );
    }

    if (parsed.resultId !== expectedId) {
      throw new ResultStoreError(
        "invalid_stored_result",
        `Stored result ${expectedId} declares id ${parsed.resultId}.`,
      );
    }

    return parsed;
  }
}
