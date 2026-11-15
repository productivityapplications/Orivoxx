/**
 * Records the checked-in seed results by actually running the fake baseline
 * adapter inside the Docker sandbox and scoring the captured repository.
 *
 * Usage:
 *   pnpm --filter @orivoxx/harness build
 *   pnpm --filter @orivoxx/harness sandbox:build
 *   node packages/harness/scripts/record-seed.mjs
 *
 * The output is `data/seed-results.json`. Every row is a real recorded run; no
 * number in that file is hand-written.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");

const { runBenchmark, createRunWorkspace, removeRunWorkspace, DockerExecutor } =
  await import(resolve(here, "..", "dist", "index.js"));
const { getTask, listTasks } = await import(
  resolve(repoRoot, "packages", "benchmarks", "dist", "index.js")
);

const variants = ["compliant", "regressed"];
const results = [];

const executor = new DockerExecutor({ network: "none" });

for (const task of listTasks()) {
  for (const variant of variants) {
    const workspace = await createRunWorkspace();

    try {
      const run = await runBenchmark({
        task: getTask(task.id),
        adapter: (await import(resolve(here, "..", "dist", "index.js"))).createFakeAdapter({
          taskId: task.id,
          variant,
        }),
        workspace,
        executor,
      });

      results.push(run.result);
      console.log(
        `${task.id}/${variant}: ${run.result.overall} ` +
          `(spec ${run.result.benches.spec}, sec ${run.result.benches.security}, ` +
          `maint ${run.result.benches.maintainability}, caps ${run.result.capsApplied.join(",") || "none"})`,
      );
    } finally {
      await removeRunWorkspace(workspace);
    }
  }
}

const document = {
  schemaVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  generator: "packages/harness/scripts/record-seed.mjs",
  note: "Fake baseline results recorded from real Docker sandbox runs. Not model results.",
  results,
};

const target = resolve(repoRoot, "data", "seed-results.json");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify(document, null, 2)}\n`, "utf8");

console.log(`wrote ${results.length} results to ${target}`);
