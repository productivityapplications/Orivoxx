/**
 * Runs a curated or remote real repository task with a brand-name agent or the
 * custom Python harness.
 *
 *   pnpm bench:real --task slugify-max-length --adapter claude-code-openrouter
 *   pnpm bench:real --task itsdangerous-future-signature --adapter python-openrouter \
 *     --model anthropic/claude-sonnet-4.5 --chaos failing_tools
 */
import { Redis } from "@upstash/redis";

import {
  CURATED_REAL_TASKS,
  LEGACY_REAL_TASKS,
  RealTaskSchema,
} from "../../benchmarks/dist/index.js";
import { createResultStore } from "../../results/dist/index.js";
import {
  cleanupClone,
  cloneTaskRepository,
  createAiderOpenRouterAdapter,
  createBrandAdapter,
  createPythonOpenRouterAdapter,
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
    if (["no-store", "help", "list"].includes(key)) {
      out[key] = true;
      continue;
    }
    out[key] = argv[++i];
  }
  return out;
}

const options = args(process.argv.slice(2));

if (options.list || options.help) {
  console.log("curated tasks:");
  for (const task of CURATED_REAL_TASKS) {
    console.log(`  ${task.id} — ${task.repoUrl} (${task.language}, ${task.difficulty})`);
  }
  console.log(`legacy tasks: ${LEGACY_REAL_TASKS.map((task) => task.id).join(", ")}`);
  console.log("adapters: claude-code-openrouter, codex-openrouter, aider-openrouter, python-openrouter");
  process.exit(0);
}

async function loadTask(id) {
  const local = [...CURATED_REAL_TASKS, ...LEGACY_REAL_TASKS].find((entry) => entry.id === id);
  if (local !== undefined) return local;

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  const raw = await redis.get(`orivoxx:task:${id}`);
  if (raw === null || raw === undefined) return null;
  const parsed = RealTaskSchema.safeParse(typeof raw === "string" ? JSON.parse(raw) : raw);
  return parsed.success ? parsed.data : null;
}

const task = await loadTask(options.task ?? "slugify-max-length");
if (task === null) {
  console.error("unknown task");
  process.exit(1);
}

const adapterId = options.adapter ?? "claude-code-openrouter";
const modelName = options.model;
const adapter =
  adapterId === "claude-code-openrouter" || adapterId === "codex-openrouter"
    ? createBrandAdapter(adapterId)
    : adapterId === "aider-openrouter"
      ? createAiderOpenRouterAdapter({ modelName: modelName ?? "anthropic/claude-sonnet-4.5" })
      : adapterId === "python-openrouter"
        ? createPythonOpenRouterAdapter({ modelName: modelName ?? "openai/gpt-4o-mini" })
        : null;

if (adapter === null) {
  console.error(`unsupported adapter ${adapterId}`);
  process.exit(1);
}

const chaos = options.chaos ?? "none";
if (!["none", "tool_error", "failing_tools", "latency", "context_pressure"].includes(chaos)) {
  console.error(`unsupported chaos ${chaos}`);
  process.exit(1);
}

const workspace = await createRunWorkspace();
const cloned = await cloneTaskRepository(task);
const executor = new DockerExecutor({
  network: "model-proxy",
  proxyBaseUrl: process.env.MODEL_BASE_URL ?? "https://openrouter.ai/api/v1",
  proxyApiKey: process.env.MODEL_API_KEY ?? process.env.OPENROUTER_API_KEY ?? null,
});

try {
  const run = await runRealTaskBenchmark({
    task,
    adapter,
    workspace,
    executor,
    chaos,
    adapterLabel:
      chaos === "none" || adapterId !== "python-openrouter"
        ? undefined
        : `python (chaos: ${chaos})`,
  });
  const summary = {
    resultId: run.result.resultId,
    taskId: run.result.taskId,
    adapter: run.result.adapter.id,
    adapterLabel: run.result.adapter.label,
    model: run.result.model?.name ?? null,
    chaos: run.result.chaos ?? null,
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
