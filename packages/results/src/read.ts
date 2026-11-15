import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { BenchmarkResult, LeaderboardEntry } from "./contracts.js";
import { LocalResultStore } from "./local.js";
import {
  ResultStoreError,
  type ResultQuery,
  type ResultStore,
  type ResultStoreKind,
} from "./store.js";
import { UPSTASH_DEFAULT_PREFIX, UpstashResultStore } from "./upstash.js";

export interface LeaderboardRead {
  entries: LeaderboardEntry[];
  source: ResultStoreKind;
  /** True when the primary store failed and the bundled seed answered instead. */
  degraded: boolean;
  problem?: string;
}

export interface ResultRead {
  result: BenchmarkResult | null;
  source: ResultStoreKind;
  degraded: boolean;
  problem?: string;
}

export interface FallbackReadOptions {
  primary: ResultStore;
  fallback: ResultStore;
  query?: ResultQuery;
  taskId?: string;
}

function describe(error: unknown): string {
  if (error instanceof ResultStoreError) {
    return error.code;
  }

  return "store_error";
}

/**
 * Reads the leaderboard from the primary store, falling back to the bundled
 * seed. The caller gets an explicit `degraded` flag so the UI can say
 * "sample data" instead of implying the shared store is healthy.
 */
export async function readLeaderboard(
  options: FallbackReadOptions,
): Promise<LeaderboardRead> {
  try {
    const entries =
      options.taskId === undefined
        ? await options.primary.list(options.query)
        : await options.primary.listByTask(options.taskId, options.query);

    return { entries, source: options.primary.kind, degraded: false };
  } catch (error) {
    const entries =
      options.taskId === undefined
        ? await options.fallback.list(options.query)
        : await options.fallback.listByTask(options.taskId, options.query);

    return {
      entries,
      source: options.fallback.kind,
      degraded: true,
      problem: describe(error),
    };
  }
}

export async function readResult(
  options: { primary: ResultStore; fallback: ResultStore },
  resultId: string,
): Promise<ResultRead> {
  try {
    const result = await options.primary.get(resultId);

    if (result !== null) {
      return { result, source: options.primary.kind, degraded: false };
    }
  } catch (error) {
    const result = await options.fallback.get(resultId);

    return {
      result,
      source: options.fallback.kind,
      degraded: true,
      problem: describe(error),
    };
  }

  const seeded = await options.fallback.get(resultId);

  return {
    result: seeded,
    source: seeded === null ? options.primary.kind : options.fallback.kind,
    degraded: false,
  };
}

export interface ResultStoreEnvironment {
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  ORIVOXX_RESULTS_DIR?: string;
}

export interface ResultStoreBundle {
  store: ResultStore;
  kind: ResultStoreKind;
}

/**
 * Server-only factory. A configured Upstash pair wins; otherwise results are
 * written to the local append-only directory. The seed file is always a
 * separate, read-only fallback.
 */
export function createResultStore(
  env: ResultStoreEnvironment,
): ResultStoreBundle {
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (url !== undefined && url.length > 0 && token !== undefined && token.length > 0) {
    return {
      store: new UpstashResultStore({ url, token, keyPrefix: UPSTASH_DEFAULT_PREFIX }),
      kind: "upstash",
    };
  }

  return {
    store: new LocalResultStore({
      directory: env.ORIVOXX_RESULTS_DIR ?? resolveDefaultResultsDirectory(),
    }),
    kind: "local",
  };
}

/**
 * `<repo>/.data/results` relative to the package, not the process cwd.
 */
export function resolveDefaultResultsDirectory(): string {
  return resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    ".data",
    "results",
  );
}
