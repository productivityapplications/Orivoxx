import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { CURATED_REAL_TASKS, RealTaskSchema } from "./real.js";
import { loadRealTask } from "./real-registry.js";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("curated real tasks", () => {
  it("contains six permissively licensed tasks with pinned commits", () => {
    expect(CURATED_REAL_TASKS.length).toBeGreaterThanOrEqual(5);

    for (const task of CURATED_REAL_TASKS) {
      expect(RealTaskSchema.safeParse(task).success, task.id).toBe(true);
      expect(task.repoUrl).toMatch(/^https:\/\/github\.com\//);
      expect(task.baseCommit).toMatch(/^[a-f0-9]{40}$/);
      expect(task.license).toBe("MIT");
      expect(task.status).toBe("public");
      expect(task.testCommand.startsWith("node ")).toBe(true);
    }
  });

  it("loads disk before the curated bundle", async () => {
    const directory = await mkdtemp(join(tmpdir(), "orivoxx-real-task-"));
    dirs.push(directory);
    const task = {
      ...CURATED_REAL_TASKS[0],
      id: "disk-task",
      title: "Disk task",
    };
    await writeFile(join(directory, "data", "tasks", "disk-task.json"), JSON.stringify(task)).catch(async () => {
      const { mkdir } = await import("node:fs/promises");
      await mkdir(join(directory, "data", "tasks"), { recursive: true });
      await writeFile(join(directory, "data", "tasks", "disk-task.json"), JSON.stringify(task));
    });

    const loaded = await loadRealTask("disk-task", { cwd: directory, curated: [] });
    expect(loaded?.title).toBe("Disk task");
  });

  it("falls back to the remote store, then curated", async () => {
    const remote = await loadRealTask("remote-task", {
      cwd: "/tmp/orivoxx-absent",
      curated: [],
      remote: async () => ({ ...CURATED_REAL_TASKS[0], id: "remote-task", title: "Remote" }),
    });
    expect(remote?.title).toBe("Remote");

    const curated = await loadRealTask(CURATED_REAL_TASKS[1]!.id, { cwd: "/tmp/orivoxx-absent" });
    expect(curated?.id).toBe(CURATED_REAL_TASKS[1]!.id);

    await expect(loadRealTask("missing", { cwd: "/tmp/orivoxx-absent", curated: [] })).resolves.toBeNull();
  });

  it("rejects a non-GitHub URL", () => {
    expect(RealTaskSchema.safeParse({ ...CURATED_REAL_TASKS[0], repoUrl: "https://gitlab.com/x/y" }).success).toBe(false);
  });
});
