/**
 * Organizer-run benchmark CLI.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local packages/harness/scripts/run-benchmark.mjs \
 *     --task taskboard --adapter python-openrouter [--model openai/gpt-4o-mini] [--no-store]
 *
 * Real adapters run in the Docker sandbox with the allowlisted model proxy.
 * The fake adapter materializes a fixture and needs no network. Results are
 * appended to the configured store unless `--no-store` is passed.
 */
import {
  adapterSummaries,
  buildAdapterRunInput,
  createAiderOpenRouterAdapter,
  createFakeAdapter,
  createPythonOpenRouterAdapter,
  createRunWorkspace,
  DockerExecutor,
  getAdapter,
  removeRunWorkspace,
  runBenchmark,
} from "../dist/index.js";
import { getTask, listTasks } from "../../benchmarks/dist/index.js";
import { createResultStore } from "../../results/dist/index.js";

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];

    if (!entry.startsWith("--")) {
      throw new Error(`Unexpected argument: ${entry}`);
    }

    const [key, inlineValue] = entry.slice(2).split("=", 2);

    if (key === "list" || key === "no-store" || key === "help") {
      options[key] = true;
      continue;
    }

    const value = inlineValue ?? argv[index + 1];

    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    if (inlineValue === undefined) {
      index += 1;
    }

    options[key] = value;
  }

  return options;
}

function printHelp() {
  console.log(`Orivoxx benchmark runner

  --list                     list tasks and adapters
  --task <id>                benchmark task (default: taskboard)
  --adapter <id>             adapter id (default: fake)
  --model <slug>             model override for a real adapter
  --variant <compliant|regressed>  fake adapter fixture (default: compliant)
  --time-limit <seconds>     override the task time limit
  --chaos <kind>             none | tool_error | latency | context_pressure
  --no-store                 do not append the result
`);
}

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

if (options.list) {
  console.log("tasks:");
  for (const task of listTasks()) {
    console.log(`  ${task.id} ${task.version} — ${task.title}`);
  }
  console.log("adapters:");
  for (const adapter of adapterSummaries()) {
    console.log(`  ${adapter.id} ${adapter.version} — ${adapter.label}`);
  }
  process.exit(0);
}

const taskId = options.task ?? "taskboard";
const adapterId = options.adapter ?? "fake";
const task = getTask(taskId);

function buildAdapter() {
  if (adapterId === "fake") {
    return createFakeAdapter({ taskId, variant: options.variant ?? "compliant" });
  }

  const registered = getAdapter(adapterId);
  const modelName = options.model ?? registered.model?.name;

  if (adapterId === "python-openrouter") {
    return createPythonOpenRouterAdapter({ modelName });
  }

  if (adapterId === "aider-openrouter") {
    return createAiderOpenRouterAdapter({ modelName });
  }

  throw new Error(`No factory for adapter "${adapterId}".`);
}

const adapter = buildAdapter();
const isFake = adapter.kind === "baseline";
const workspace = await createRunWorkspace();
const startedAt = Date.now();
const input = buildAdapterRunInput(task, {
  model: adapter.model,
  limits: options["time-limit"]
    ? { timeLimitSeconds: Number(options["time-limit"]) }
    : undefined,
  chaos: options.chaos ?? "none",
});

const executor = isFake
  ? undefined
  : new DockerExecutor({
      network: "model-proxy",
      proxyBaseUrl: process.env.MODEL_BASE_URL ?? "https://openrouter.ai/api/v1",
      proxyApiKey:
        process.env.MODEL_API_KEY ?? process.env.OPENROUTER_API_KEY ?? null,
    });

try {
  const run = await runBenchmark({ task, adapter, workspace, executor, input });
  const summary = {
    resultId: run.result.resultId,
    taskId: run.result.taskId,
    adapterId: run.result.adapter.id,
    adapterVersion: run.result.adapterVersion,
    model: run.result.model?.name ?? null,
    status: run.result.run.status,
    exitCode: run.result.run.exitCode,
    durationMs: Date.now() - startedAt,
    overall: run.result.overall,
    benches: run.result.benches,
    caps: run.result.capsApplied,
    tally: run.result.tally,
    repositoryFingerprint: run.result.repositoryFingerprint.slice(0, 16),
    captured: {
      files: run.run.stats.fileCount,
      bytes: run.run.stats.totalBytes,
    },
    stdout: run.run.stdoutSummary.split("\n").filter(Boolean).slice(-4),
    stderr: run.run.stderrSummary.split("\n").filter(Boolean).slice(-4),
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

  if (run.result.run.status !== "completed") {
    process.exitCode = 1;
  }
} finally {
  await removeRunWorkspace(workspace);
}
