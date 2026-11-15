import "server-only";

import {
  createResultStore,
  readLeaderboard,
  readResult,
  SeedResultStore,
  type LeaderboardEntry,
  type ResultStore,
  type ResultStoreKind,
  type BenchmarkResult,
} from "@orivoxx/results";

// Bundled at build time, so the read-only deployment never depends on a
// relative path or on Redis being reachable.
import seedDocument from "../../../../data/seed-results.json";
import { getServerEnv } from "./env";

/**
 * The deployed app is read-only: real runs are executed by the organizer with
 * `packages/harness` and appended through the shared store. When no shared
 * store is configured, the bundled seed rows are the leaderboard rather than an
 * empty page.
 */
export interface WebLeaderboard {
  entries: LeaderboardEntry[];
  store: ResultStoreKind;
  /** True when the shared store failed and the seed answered instead. */
  degraded: boolean;
  readOnly: boolean;
  problem?: string;
}

export interface WebResult {
  result: BenchmarkResult | null;
  store: ResultStoreKind;
  degraded: boolean;
  readOnly: boolean;
  problem?: string;
}

export interface SeedStatus {
  available: boolean;
  rows: number;
  diagnostics: string[];
}

let cachedSeed: Promise<SeedResultStore> | undefined;

function loadBundledSeed(): SeedResultStore {
  try {
    return SeedResultStore.parse(seedDocument);
  } catch {
    return new SeedResultStore([], ["seed_invalid"]);
  }
}

export async function getSeedStore(): Promise<SeedResultStore> {
  cachedSeed ??= Promise.resolve(loadBundledSeed());

  return cachedSeed;
}

/** Tests only: forget the parsed seed. */
export function resetResultServerCache(): void {
  cachedSeed = undefined;
}

export async function getSeedStatus(): Promise<SeedStatus> {
  const seed = await getSeedStore();
  const entries = await seed.list({ limit: 200 });

  return {
    available: seed.diagnostics.length === 0,
    rows: entries.length,
    diagnostics: seed.diagnostics,
  };
}

interface StoreBundle {
  primary: ResultStore;
  primaryKind: ResultStoreKind;
  seed: SeedResultStore;
}

function isDeploymentWithoutStore(): boolean {
  return (
    process.env.VERCEL === "1" ||
    process.env.ORIVOXX_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

async function stores(): Promise<StoreBundle> {
  const env = getServerEnv();
  const seed = await getSeedStore();
  const bundle = createResultStore({
    UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN,
    ORIVOXX_RESULTS_DIR: env.ORIVOXX_DATA_DIR,
  });

  return { primary: bundle.store, primaryKind: bundle.kind, seed };
}

export async function webLeaderboard(
  options: { taskId?: string; limit?: number } = {},
): Promise<WebLeaderboard> {
  const { primary, seed } = await stores();
  const readOnly = primary.kind === "seed";
  const query = { limit: options.limit };

  // No shared store and not a local run directory: serve the bundled rows.
  if (!readOnly && primary.kind === "local" && isDeploymentWithoutStore()) {
    const entries =
      options.taskId === undefined
        ? await seed.list(query)
        : await seed.listByTask(options.taskId, query);

    return { entries, store: "seed", degraded: false, readOnly: true };
  }

  const read = await readLeaderboard({ primary, fallback: seed, query, taskId: options.taskId });

  if (read.degraded) {
    return {
      entries: read.entries,
      store: read.source,
      degraded: true,
      readOnly: true,
      problem: read.problem ?? "store_unavailable",
    };
  }

  // A fresh local store is empty; show the recorded sample rows instead of a
  // blank page, labelled as sample data by the caller.
  if (read.entries.length === 0 && primary.kind === "local") {
    const entries =
      options.taskId === undefined
        ? await seed.list(query)
        : await seed.listByTask(options.taskId, query);

    if (entries.length > 0) {
      return { entries, store: "seed", degraded: false, readOnly: true };
    }
  }

  return {
    entries: read.entries,
    store: read.source,
    degraded: false,
    readOnly: read.source === "seed",
  };
}

export async function webResult(resultId: string): Promise<WebResult> {
  const { primary, seed } = await stores();

  if (primary.kind === "local" && isDeploymentWithoutStore()) {
    const result = await seed.get(resultId);

    return {
      result,
      store: "seed",
      degraded: false,
      readOnly: true,
    };
  }

  const read = await readResult({ primary, fallback: seed }, resultId);

  return {
    result: read.result,
    store: read.source,
    degraded: read.degraded,
    readOnly: read.source === "seed",
    problem: read.problem,
  };
}
