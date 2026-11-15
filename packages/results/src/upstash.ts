import {
  BenchmarkResultSchema,
  LeaderboardEntrySchema,
  type BenchmarkResult,
  type LeaderboardEntry,
} from "./contracts.js";
import { toLeaderboardEntry } from "./contracts.js";
import {
  clampLimit,
  rankLeaderboard,
  ResultStoreError,
  type ResultQuery,
  type ResultStore,
} from "./store.js";

export interface UpstashResultStoreOptions {
  url: string;
  token: string;
  /** Namespace for every key, so a shared Redis can host staging data too. */
  keyPrefix?: string;
  fetch?: typeof fetch;
  /** Fetch this many extra rows so in-memory tie-breaking is correct. */
  overscan?: number;
}

export const UPSTASH_DEFAULT_PREFIX = "orivoxx:v1";

/**
 * Atomic append: the result document and both sorted indexes are written in
 * one script, and an existing id aborts the whole append. A partial write can
 * never advertise a row that cannot be fetched.
 */
const APPEND_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  return 0
end
redis.call('SET', KEYS[1], ARGV[1])
redis.call('ZADD', KEYS[2], ARGV[2], ARGV[3])
redis.call('ZADD', KEYS[3], ARGV[2], ARGV[3])
return 1
`.trim();

interface UpstashReply {
  result?: unknown;
  error?: string;
}

function isReply(value: unknown): value is UpstashReply {
  return value !== null && typeof value === "object";
}

export class UpstashResultStore implements ResultStore {
  readonly kind = "upstash" as const;
  readonly #url: string;
  readonly #token: string;
  readonly #prefix: string;
  readonly #fetch: typeof fetch;
  readonly #overscan: number;

  constructor(options: UpstashResultStoreOptions) {
    if (!/^https?:\/\//.test(options.url)) {
      throw new ResultStoreError(
        "store_unavailable",
        "UPSTASH_REDIS_REST_URL must be an absolute http(s) URL.",
      );
    }

    if (options.token.length === 0) {
      throw new ResultStoreError(
        "store_unavailable",
        "UPSTASH_REDIS_REST_TOKEN must not be empty.",
      );
    }

    this.#url = options.url.replace(/\/+$/g, "");
    this.#token = options.token;
    this.#prefix = (options.keyPrefix ?? UPSTASH_DEFAULT_PREFIX).replace(/\/+$/g, "");
    this.#fetch = options.fetch ?? fetch;
    this.#overscan = options.overscan ?? 50;
  }

  #resultKey(resultId: string): string {
    return `${this.#prefix}:result:${resultId}`;
  }

  #taskIndexKey(taskId: string): string {
    return `${this.#prefix}:rank:task:${taskId}`;
  }

  #allIndexKey(): string {
    return `${this.#prefix}:rank:all`;
  }

  async #command(args: readonly (string | number)[]): Promise<unknown> {
    let response: Response;

    try {
      response = await this.#fetch(this.#url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.#token}`,
          "content-type": "application/json",
          "cache-control": "no-store",
        },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ResultStoreError("store_unavailable", "The result store is unreachable.");
    }

    if (!response.ok) {
      throw new ResultStoreError(
        "store_unavailable",
        `The result store responded with status ${response.status}.`,
      );
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new ResultStoreError("read_failed", "The result store returned invalid JSON.");
    }

    if (!isReply(payload)) {
      throw new ResultStoreError("read_failed", "The result store returned an invalid reply.");
    }

    if (payload.error !== undefined) {
      throw new ResultStoreError("store_unavailable", "The result store rejected a command.");
    }

    return payload.result;
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

    const entry = toLeaderboardEntry(parsed.data);
    const reply = await this.#command([
      "EVAL",
      APPEND_SCRIPT,
      "3",
      this.#resultKey(parsed.data.resultId),
      this.#taskIndexKey(parsed.data.taskId),
      this.#allIndexKey(),
      JSON.stringify(parsed.data),
      String(-parsed.data.overall),
      JSON.stringify(entry),
    ]);

    if (reply === 0) {
      throw new ResultStoreError(
        "duplicate_result",
        `Result ${parsed.data.resultId} already exists. Results are append-only.`,
      );
    }

    if (reply !== 1) {
      throw new ResultStoreError("write_failed", "The result store did not confirm the append.");
    }
  }

  async get(resultId: string): Promise<BenchmarkResult | null> {
    const reply = await this.#command(["GET", this.#resultKey(resultId)]);

    if (reply === null || reply === undefined) {
      return null;
    }

    if (typeof reply !== "string") {
      throw new ResultStoreError("read_failed", "The stored result is not a string.");
    }

    let parsed: BenchmarkResult;

    try {
      parsed = BenchmarkResultSchema.parse(JSON.parse(reply));
    } catch {
      throw new ResultStoreError(
        "invalid_stored_result",
        `Stored result ${resultId} is invalid.`,
      );
    }

    return parsed.resultId === resultId ? parsed : null;
  }

  async list(query: ResultQuery = {}): Promise<LeaderboardEntry[]> {
    return this.#readIndex(this.#allIndexKey(), query);
  }

  async listByTask(
    taskId: string,
    query: ResultQuery = {},
  ): Promise<LeaderboardEntry[]> {
    return this.#readIndex(this.#taskIndexKey(taskId), query);
  }

  async #readIndex(key: string, query: ResultQuery): Promise<LeaderboardEntry[]> {
    const stop = clampLimit(query.limit) + this.#overscan - 1;
    const reply = await this.#command(["ZRANGE", key, "0", String(stop)]);

    if (!Array.isArray(reply)) {
      return [];
    }

    const entries: LeaderboardEntry[] = [];

    for (const member of reply) {
      if (typeof member !== "string") {
        continue;
      }

      try {
        entries.push(LeaderboardEntrySchema.parse(JSON.parse(member)));
      } catch {
        // A single corrupt index member must not take down the leaderboard.
      }
    }

    return rankLeaderboard(entries, query.limit);
  }
}
