import "server-only";

import {
  clampLimit,
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
export type LeaderboardKind = "agents" | "baselines" | "all";

export interface WebLeaderboard {
  entries: LeaderboardEntry[];
  store: ResultStoreKind;
  /** True when the shared store failed and the seed answered instead. */
  degraded: boolean;
  readOnly: boolean;
  /** True when an agents-only read had no harness rows and showed baselines. */
  baselinesOnly: boolean;
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

function selectKind(
  entries: LeaderboardEntry[],
  kind: LeaderboardKind,
  limit: number | undefined,
): { entries: LeaderboardEntry[]; baselinesOnly: boolean } {
  const cap = clampLimit(limit);

  if (kind === "baselines") {
    return {
      entries: entries.filter((entry) => entry.adapter.kind === "baseline").slice(0, cap),
      baselinesOnly: false,
    };
  }

  if (kind === "all") {
    return { entries: entries.slice(0, cap), baselinesOnly: false };
  }

  const agents = entries.filter((entry) => entry.adapter.kind !== "baseline");

  if (agents.length > 0) {
    return { entries: agents.slice(0, cap), baselinesOnly: false };
  }

  // No harness result exists yet: show the recorded baselines, labelled.
  return {
    entries: entries.filter((entry) => entry.adapter.kind === "baseline").slice(0, cap),
    baselinesOnly: entries.length > 0,
  };
}

export async function webLeaderboard(
  options: { taskId?: string; limit?: number; kind?: LeaderboardKind } = {},
): Promise<WebLeaderboard> {
  const { primary, seed } = await stores();
  const kind = options.kind ?? "agents";
  // Read enough rows that an agents-only filter still fills the requested page.
  const query = { limit: kind === "agents" ? 200 : options.limit };

  const read = await readLeaderboard({ primary, fallback: seed, query, taskId: options.taskId });

  if (read.degraded) {
    const selected = selectKind(read.entries, kind, options.limit);

    return {
      entries: selected.entries,
      store: read.source,
      degraded: true,
      readOnly: true,
      baselinesOnly: selected.baselinesOnly,
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
      const selected = selectKind(entries, kind, options.limit);

      return {
        entries: selected.entries,
        store: "seed",
        degraded: false,
        readOnly: true,
        baselinesOnly: selected.baselinesOnly,
      };
    }
  }

  const selected = selectKind(read.entries, kind, options.limit);

  return {
    entries: selected.entries,
    store: read.source,
    degraded: false,
    readOnly: read.source === "seed",
    baselinesOnly: selected.baselinesOnly,
  };
}

export async function webResult(resultId: string): Promise<WebResult> {
  const { primary, seed } = await stores();
  const read = await readResult({ primary, fallback: seed }, resultId);

  return {
    result: read.result,
    store: read.source,
    degraded: read.degraded,
    readOnly: read.source === "seed",
    problem: read.problem,
  };
}
