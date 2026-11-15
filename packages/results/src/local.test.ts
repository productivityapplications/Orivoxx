import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createResultId } from "./id.js";
import { LocalResultStore } from "./local.js";
import { sampleResult } from "./samples.js";
import { ResultStoreError } from "./store.js";

const directories: string[] = [];

function directory(): string {
  const path = join(
    process.env.TMPDIR ?? "/tmp",
    `orivoxx-results-test-${Math.random().toString(36).slice(2, 10)}`,
  );
  directories.push(path);

  return path;
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

const COMPLIANT = sampleResult({
  resultId: "res_local0000000000000001",
  createdAt: "2026-11-15T10:00:00.000Z",
});
const REGRESSED = sampleResult({
  resultId: "res_local0000000000000002",
  createdAt: "2026-11-15T09:00:00.000Z",
  variant: "regressed",
});

describe("local append-only store", () => {
  it("stores one immutable file per result and reads it back", async () => {
    const store = new LocalResultStore({ directory: directory() });

    await store.append(COMPLIANT);

    const loaded = await store.get(COMPLIANT.resultId);

    expect(loaded).toEqual(COMPLIANT);
    const files = await readdir(store.directory);

    expect(files).toEqual([`${COMPLIANT.resultId}.json`]);
  });

  it("rejects a duplicate id instead of overwriting evidence", async () => {
    const store = new LocalResultStore({ directory: directory() });

    await store.append(COMPLIANT);

    await expect(store.append(COMPLIANT)).rejects.toMatchObject({
      code: "duplicate_result",
    });

    const written = JSON.parse(
      await readFile(join(store.directory, `${COMPLIANT.resultId}.json`), "utf8"),
    );

    expect(written.resultId).toBe(COMPLIANT.resultId);
  });

  it("returns null for an unknown result", async () => {
    const store = new LocalResultStore({ directory: directory() });

    await expect(store.get("res_missing000000000000")).resolves.toBeNull();
  });

  it("returns an empty leaderboard for a missing directory", async () => {
    const store = new LocalResultStore({ directory: directory() });

    await expect(store.list()).resolves.toEqual([]);
  });

  it("sorts the leaderboard and filters by task", async () => {
    const store = new LocalResultStore({ directory: directory() });

    await store.append(REGRESSED);
    await store.append(COMPLIANT);

    const all = await store.list();

    expect(all.map((entry) => entry.resultId)).toEqual([
      COMPLIANT.resultId,
      REGRESSED.resultId,
    ]);
    expect(all.map((entry) => entry.overall)).toEqual([99.5, 59.9]);

    const taskboard = await store.listByTask("taskboard");

    expect(taskboard).toHaveLength(2);
    await expect(store.listByTask("linkstash")).resolves.toEqual([]);
  });

  it("applies the limit after ranking", async () => {
    const store = new LocalResultStore({ directory: directory() });

    await store.append(REGRESSED);
    await store.append(COMPLIANT);

    const top = await store.list({ limit: 1 });

    expect(top.map((entry) => entry.resultId)).toEqual([COMPLIANT.resultId]);
  });

  it("refuses to write a result that violates the contract", async () => {
    const store = new LocalResultStore({ directory: directory() });

    await expect(
      store.append({ ...COMPLIANT, overall: 12 } as typeof COMPLIANT),
    ).rejects.toMatchObject({ code: "invalid_stored_result" });

    await expect(store.list()).resolves.toEqual([]);
  });

  it("fails loudly on a corrupt stored file", async () => {
    const target = directory();
    const store = new LocalResultStore({ directory: target });

    await mkdir(target, { recursive: true });
    await writeFile(join(target, "res_corrupt00000000000000.json"), "{not json", "utf8");

    await expect(store.get("res_corrupt00000000000000")).rejects.toBeInstanceOf(
      ResultStoreError,
    );
    await expect(store.list()).rejects.toMatchObject({ code: "invalid_stored_result" });
  });

  it("ignores files that are not result documents", async () => {
    const target = directory();
    const store = new LocalResultStore({ directory: target });

    await mkdir(target, { recursive: true });
    await writeFile(join(target, "notes.txt"), "ignore me", "utf8");
    await writeFile(join(target, ".DS_Store"), "ignore me", "utf8");
    await store.append(COMPLIANT);

    await expect(store.list()).resolves.toHaveLength(1);
  });

  it("mints ids that satisfy the result contract", () => {
    const ids = new Set(Array.from({ length: 50 }, () => createResultId()));

    expect(ids.size).toBe(50);

    for (const id of ids) {
      expect(id).toMatch(/^res_[a-z0-9]{10,40}$/);
    }
  });
});
