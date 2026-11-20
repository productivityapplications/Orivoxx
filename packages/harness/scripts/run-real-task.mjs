/**
 * Runs a curated real repository task with a brand-name agent.
 *
 *   pnpm bench:real --task is-decimal-single-char --adapter claude-code-openrouter
 */
import { CURATED_REAL_TASKS, getTask } from "../../benchmarks/dist/index.js";
import { createResultStore } from "../../results/dist/index.js";
import {
  cleanupClone,
  cloneTaskRepository,
  createAiderOpenRouterAdapter,
  createBrandAdapter,
  createRunWorkspace,
  DockerExecutor,
  removeRunWorkspace,
  runRealTaskBenchmark,
} from "../dist/index.js";

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    if (["no-store", "help", "list"].includes(key)) { out[key] = true; continue; }
    out[key] = argv[++i];
  }
  return out;
}

const options = args(process.argv.slice(2));

if (options.list || options.help) {
  console.log("curated tasks:");
  for (const task of CURATED_REAL_TASKS) console.log(`  ${task.id} — ${task.repoUrl} (${task.language})`);
  console.log("adapters: claude-code-openrouter, codex-openrouter, aider-openrouter");
  process.exit(0);
}

const task = CURATED_REAL_TASKS.find((entry) => entry.id === (options.task ?? "is-decimal-single-char"));
if (!task) { console.error("unknown task"); process.exit(1); }

const adapterId = options.adapter ?? "claude-code-openrouter";
const adapter =
  adapterId === "claude-code-openrouter" || adapterId === "codex-openrouter"
    ? createBrandAdapter(adapterId)
    : adapterId === "aider-openrouter"
      ? createAiderOpenRouterAdapter({ modelName: options.model ?? "anthropic/claude-sonnet-4.5" })
      : null;

if (adapter === null) { console.error(`unsupported adapter ${adapterId}`); process.exit(1); }

const workspace = await createRunWorkspace();
const cloned = await cloneTaskRepository(task);
const executor = new DockerExecutor({
  network: "model-proxy",
  proxyBaseUrl: process.env.MODEL_BASE_URL ?? "https://openrouter.ai/api/v1",
  proxyApiKey: process.env.MODEL_API_KEY ?? process.env.OPENROUTER_API_KEY ?? null,
});

try {
  const run = await runRealTaskBenchmark({ task, adapter, workspace, executor, clone: cloned });
  const summary = {
    resultId: run.result.resultId,
    taskId: run.result.taskId,
    adapter: run.result.adapter.id,
    model: run.result.model?.name ?? null,
    test: run.result.test,
    taskSuccess: run.result.taskSuccess,
    overall: run.result.overall,
    attribution: run.result.attribution,
    metrics: run.result.metrics,
    status: run.result.run.status,
    durationMs: run.result.run.durationMs,
  };
  if (!options["no-store"]) {
    const { store, kind } = createResultStore({
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
      ORIVOXX_RESULTS_DIR: process.env.ORIVOXX_DATA_DIR,
    });
    await store.append(run.result);
    summary.store = kind;
  }
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = run.result.taskSuccess ? 0 : 1;
} finally {
  await cleanupClone(cloned.directory);
  await removeRunWorkspace(workspace);
}
