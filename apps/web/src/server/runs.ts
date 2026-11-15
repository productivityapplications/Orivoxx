import "server-only";

import { getTask } from "@orivoxx/benchmarks";
import {
  createFakeAdapter,
  createRunWorkspace,
  removeRunWorkspace,
  runBenchmark,
} from "@orivoxx/harness";
import { createResultStore, type BenchmarkResult, type ResultStoreKind } from "@orivoxx/results";

import { getServerEnv } from "./env";

export type FakeVariant = "compliant" | "regressed";

export interface FakeRunOutput {
  result: BenchmarkResult;
  store: ResultStoreKind;
}

const MAX_CONCURRENT_RUNS = 2;
let activeRuns = 0;

/** Bounds concurrent fake runs inside one server instance. */
export function acquireFakeRunSlot(): (() => void) | null {
  if (activeRuns >= MAX_CONCURRENT_RUNS) {
    return null;
  }

  activeRuns += 1;
  let released = false;

  return () => {
    if (!released) {
      released = true;
      activeRuns -= 1;
    }
  };
}

export function activeFakeRuns(): number {
  return activeRuns;
}

/**
 * The public, self-serve path. It executes no model and no agent: the fake
 * adapter materializes a checked-in fixture, the deterministic engine scores
 * it, and the immutable result is appended to the store.
 */
export async function runFakeBenchmark(
  taskId: string,
  variant: FakeVariant,
): Promise<FakeRunOutput> {
  const task = getTask(taskId);
  const adapter = createFakeAdapter({ taskId, variant });
  const workspace = await createRunWorkspace();

  try {
    const { result } = await runBenchmark({ task, adapter, workspace });
    const env = getServerEnv();
    const { store, kind } = createResultStore({
      UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN,
      ORIVOXX_RESULTS_DIR: env.ORIVOXX_DATA_DIR,
    });

    await store.append(result);

    return { result, store: kind };
  } finally {
    await removeRunWorkspace(workspace).catch(() => undefined);
  }
}
