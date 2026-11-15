import { describe, expect, it } from "vitest";

import { LocalResultStore } from "./local.js";
import { readLeaderboard, readResult } from "./read.js";
import { sampleResult } from "./samples.js";
import { SeedResultStore } from "./seed.js";
import type { ResultStore } from "./store.js";

const COMPLIANT = sampleResult({
  resultId: "res_seed00000000000000001",
  createdAt: "2026-11-15T10:00:00.000Z",
});
const REGRESSED = sampleResult({
  resultId: "res_seed00000000000000002",
  createdAt: "2026-11-15T09:00:00.000Z",
  variant: "regressed",
});

function seedDocument(results: unknown[]): string {
  return JSON.stringify({ schemaVersion: "1.0.0", results });
}

function memoryStore() {
  const rows = new Map<string, typeof COMPLIANT>();

  return {
    kind: "memory" as const,
    async append(result: typeof COMPLIANT) {
      rows.set(result.resultId, result);
    },
    async get(resultId: string) {
      return rows.get(resultId) ?? null;
    },
    async list() {
      return [];
    },
    async listByTask() {
      return [];
    },
  };
}

describe("seed results", () => {
  it("parses a valid seed document and ranks it", async () => {
    const store = SeedResultStore.parse(seedDocument([REGRESSED, COMPLIANT]));

    expect(store.diagnostics).toEqual([]);
    expect((await store.list()).map((entry) => entry.resultId)).toEqual([
      COMPLIANT.resultId,
      REGRESSED.resultId,
    ]);
    expect(await store.get(COMPLIANT.resultId)).toEqual(COMPLIANT);
  });

  it("drops an invalid row instead of failing the whole page", async () => {
    const store = SeedResultStore.parse(
      seedDocument([COMPLIANT, { resultId: "broken" }, REGRESSED]),
    );

    expect(store.diagnostics).toEqual(["seed_res_1_invalid"]);
    await expect(store.list()).resolves.toHaveLength(2);
  });

  it("rejects a malformed seed document", () => {
    expect(() => SeedResultStore.parse("{")).toThrow(/not valid JSON/);
    expect(() => SeedResultStore.parse(JSON.stringify({ results: {} }))).toThrow(
      /results array/,
    );
  });

  it("is read-only", async () => {
    const seed = SeedResultStore.parse(seedDocument([COMPLIANT]));
    const store: ResultStore = seed;

    await expect(store.append(COMPLIANT)).rejects.toMatchObject({ code: "write_failed" });
  });

  it("filters by task", async () => {
    const linkstash = sampleResult({
      resultId: "res_seed00000000000000003",
      createdAt: "2026-11-15T08:00:00.000Z",
      taskId: "linkstash",
    });
    const store = SeedResultStore.parse(seedDocument([COMPLIANT, linkstash]));

    expect(await store.listByTask("linkstash")).toHaveLength(1);
    expect(await store.listByTask("taskboard")).toHaveLength(1);
  });
});

describe("fallback reads", () => {
  it("uses the primary store when it answers", async () => {
    const primary = new LocalResultStore({ directory: "/tmp/orivoxx-absent-primary" });
    const fallback = SeedResultStore.parse(seedDocument([COMPLIANT]));
    const read = await readLeaderboard({ primary, fallback });

    expect(read.source).toBe("local");
    expect(read.degraded).toBe(false);
    expect(read.entries).toEqual([]);
  });

  it("falls back to the seed when the primary store fails", async () => {
    const primary = {
      kind: "upstash" as const,
      async append() {},
      async get() {
        throw new Error("down");
      },
      async list() {
        throw new Error("down");
      },
      async listByTask() {
        throw new Error("down");
      },
    };
    const fallback = SeedResultStore.parse(seedDocument([COMPLIANT, REGRESSED]));
    const read = await readLeaderboard({ primary, fallback });

    expect(read.degraded).toBe(true);
    expect(read.problem).toBe("store_error");
    expect(read.source).toBe("seed");
    expect(read.entries).toHaveLength(2);
  });

  it("falls back for a task-scoped read too", async () => {
    const primary = {
      kind: "upstash" as const,
      async append() {},
      async get() {
        return null;
      },
      async list() {
        return [];
      },
      async listByTask(): Promise<never> {
        throw new Error("down");
      },
    };
    const fallback = SeedResultStore.parse(seedDocument([COMPLIANT]));
    const read = await readLeaderboard({ primary, fallback, taskId: "taskboard" });

    expect(read.degraded).toBe(true);
    expect(read.entries).toHaveLength(1);
  });

  it("reads a single result from either store", async () => {
    const fallback = SeedResultStore.parse(seedDocument([COMPLIANT]));

    const local = await readResult({ primary: memoryStore(), fallback }, COMPLIANT.resultId);

    expect(local.result?.resultId).toBe(COMPLIANT.resultId);
    expect(local.degraded).toBe(false);

    const seeded = await readResult(
      { primary: memoryStore(), fallback },
      COMPLIANT.resultId,
    );

    expect(seeded.source).toBe("seed");
    expect(seeded.result?.resultId).toBe(COMPLIANT.resultId);

    const missing = await readResult({ primary: memoryStore(), fallback }, "res_nope00000000000000000");

    expect(missing.result).toBeNull();
  });

  it("marks a degraded single read when the primary throws", async () => {
    const primary = {
      kind: "upstash" as const,
      async append() {},
      async get(): Promise<never> {
        throw new Error("down");
      },
      async list() {
        return [];
      },
      async listByTask() {
        return [];
      },
    };
    const fallback = SeedResultStore.parse(seedDocument([COMPLIANT]));
    const read = await readResult({ primary, fallback }, COMPLIANT.resultId);

    expect(read.degraded).toBe(true);
    expect(read.result?.resultId).toBe(COMPLIANT.resultId);
  });
});
