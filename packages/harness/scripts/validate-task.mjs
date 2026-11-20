/**
 * Six-gate validation worker. It runs in the same Docker sandbox as benchmark
 * agents.
 *
 * Queue mode (one pending community task):
 *   node --env-file=.env.local packages/harness/scripts/validate-task.mjs
 *
 * Curated mode (no queue write):
 *   node packages/harness/scripts/validate-task.mjs --task slugify-max-length
 */
import { Redis } from "@upstash/redis";

import {
  CURATED_REAL_TASKS,
  LEGACY_REAL_TASKS,
  RealTaskSchema,
  RealTaskValidationSchema,
} from "../../benchmarks/dist/index.js";
import {
  cleanupClone,
  cloneTaskRepository,
  createRunWorkspace,
  DockerExecutor,
  parseTestCommand,
  removeRunWorkspace,
  writeProjectFiles,
} from "../dist/index.js";

const PENDING = "orivoxx:validations:pending";
const PROCESSING = "orivoxx:validations:processing";
const taskKey = (id) => `orivoxx:task:${id}`;
const eventsKey = (id) => `orivoxx:task:${id}:validation`;
const PROXY = "http://model-proxy:8080";

const args = process.argv.slice(2);
const directTaskId = args.includes("--task") ? args[args.indexOf("--task") + 1] : null;

let redis = null;
if (!directTaskId) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in queue mode");
    process.exit(1);
  }
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

function installCommandFor(task, files) {
  if (task.installCommand !== undefined) return task.installCommand;

  const packageJson = files.find((file) => file.path === "package.json");
  if (packageJson !== undefined) {
    try {
      const parsed = JSON.parse(packageJson.content);
      if (Object.keys(parsed.dependencies ?? {}).length > 0) {
        return "npm install --no-audit --no-fund";
      }
    } catch {
      // Fall through to the Python checks.
    }
  }

  if (files.some((file) => file.path === "pyproject.toml" || file.path === "setup.py")) {
    return "pip install -e .";
  }

  if (files.some((file) => file.path === "requirements.txt")) {
    return "pip install -r requirements.txt";
  }

  return null;
}

async function licenseFor(task, files) {
  const [owner, repo] = task.repoUrl.replace("https://github.com/", "").split("/");
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "orivoxx",
        ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
    });
    if (response.ok) {
      const body = await response.json();
      const spdx = body?.license?.spdx_id;
      if (typeof spdx === "string") return spdx;
    }
  } catch {
    // Fall back to the LICENSE file heuristic.
  }

  const license = files.find((file) => /(^|\/)LICENSE(\.txt)?$/i.test(file.path));
  if (!license) return "unknown";
  if (/MIT License|Permission is hereby granted, free of charge/i.test(license.content)) return "MIT";
  if (/Apache License/i.test(license.content)) return "Apache-2.0";
  if (/BSD 3-Clause/i.test(license.content)) return "BSD-3-Clause";
  if (/BSD 2-Clause/i.test(license.content)) return "BSD-2-Clause";
  if (/ISC License/i.test(license.content)) return "ISC";
  return "unknown";
}

const PERMISSIVE = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "MPL-2.0"]);

/**
 * Runs the six gates and returns the bounded validation record. The caller
 * decides whether to persist it.
 */
async function runGates(task, emit = async () => {}) {
  const gates = {
    cloned: false,
    installs: false,
    testFailsAtBase: false,
    deterministic: false,
    timeBounded: false,
    licenseOk: false,
    checkedAt: new Date().toISOString(),
  };
  let clone = null;
  let workspace = null;
  let failure = null;
  let license = "unknown";

  try {
    await emit("cloned", "start", "fetching the repository at the base commit");
    clone = await cloneTaskRepository(task);
    gates.cloned = true;
    await emit("cloned", "pass", `${clone.files.length} text files`);

    license = await licenseFor(task, clone.files);
    gates.licenseOk = PERMISSIVE.has(license);
    await emit("license", gates.licenseOk ? "pass" : "fail", `license: ${license}`);
    if (!gates.licenseOk) failure = "license_not_permissive";

    const installCommand = installCommandFor(task, clone.files);
    workspace = await createRunWorkspace();
    await writeProjectFiles(workspace, clone.files);
    if ((task.testFiles ?? []).length > 0) {
      await writeProjectFiles(workspace, task.testFiles, { overwrite: true });
    }

    if (installCommand === null) {
      gates.installs = true;
      await emit("installs", "pass", "no external dependencies");
    } else {
      await emit("installs", "start", `running ${installCommand.split(" ")[0]} install`);
      const proxyExecutor = new DockerExecutor({
        network: "model-proxy",
        proxyBaseUrl: "https://openrouter.ai/api/v1",
        proxyApiKey: "orivoxx-validation",
      });
      const install = parseTestCommand(installCommand);
      const installed = await proxyExecutor.execute({
        command: {
          file: install.file,
          args: install.args,
          env: {
            HTTPS_PROXY: PROXY,
            HTTP_PROXY: PROXY,
            PIP_DISABLE_PIP_VERSION_CHECK: "1",
            NPM_CONFIG_AUDIT: "false",
            NPM_CONFIG_FUND: "false",
          },
        },
        workspace,
        timeoutMs: 300_000,
        maxOutputBytes: 1_048_576,
      });
      gates.installs = !installed.timedOut && installed.exitCode === 0;
      await emit(
        "installs",
        gates.installs ? "pass" : "fail",
        `${installCommand} exit=${installed.exitCode ?? "timeout"} in ${installed.durationMs}ms`,
      );
      if (!gates.installs && failure === null) failure = "install_failed";
    }

    const command = parseTestCommand(task.testCommand);
    const executor = new DockerExecutor({ network: "none" });
    const results = [];

    for (let run = 0; run < 3; run += 1) {
      const started = Date.now();
      const result = await executor.execute({
        command,
        workspace,
        timeoutMs: 600_000,
        maxOutputBytes: 1_048_576,
      });
      results.push(result);
      await emit(
        "test_fails_at_base",
        "start",
        `run ${run + 1}/3 exit=${result.exitCode ?? "timeout"} in ${Date.now() - started}ms`,
      );
      if (result.timedOut || result.exitCode === 0) break;
    }

    gates.testFailsAtBase =
      results.length > 0 && results[0].timedOut === false && results[0].exitCode !== 0;
    gates.deterministic =
      results.length === 3 &&
      results.every((result) => !result.timedOut && result.exitCode !== 0);
    gates.timeBounded =
      results.length > 0 && results.every((result) => result.durationMs < 600_000);

    await emit(
      "test_fails_at_base",
      gates.testFailsAtBase ? "pass" : "fail",
      `base exit ${results[0]?.exitCode ?? "timeout"}`,
    );
    await emit(
      "deterministic",
      gates.deterministic ? "pass" : "fail",
      `${results.length} failing runs`,
    );
    await emit(
      "time_bounded",
      gates.timeBounded ? "pass" : "fail",
      results.map((result) => result.durationMs).join(", ") + "ms",
    );

    if (failure === null && !gates.testFailsAtBase) failure = "test_does_not_fail_at_base";
    else if (failure === null && !gates.deterministic) failure = "test_not_deterministic";
    else if (failure === null && !gates.timeBounded) failure = "test_exceeds_time_budget";
  } catch (error) {
    failure = error instanceof Error ? error.message.slice(0, 200) : "validation_error";
    await emit("error", "fail", failure);
  } finally {
    if (workspace !== null) await removeRunWorkspace(workspace).catch(() => undefined);
    if (clone !== null) await cleanupClone(clone.directory);
  }

  return {
    gates: RealTaskValidationSchema.parse(gates),
    failure,
    license,
  };
}

if (directTaskId !== null) {
  const task = [...CURATED_REAL_TASKS, ...LEGACY_REAL_TASKS].find(
    (entry) => entry.id === directTaskId,
  );
  if (task === undefined) {
    console.error(`unknown curated task ${directTaskId}`);
    process.exit(1);
  }
  const result = await runGates(task, async (gate, status, detail) => {
    console.error(`[${gate}] ${status}: ${detail}`);
  });
  console.log(JSON.stringify({ id: task.id, ...result }, null, 2));
  process.exit(result.failure === null ? 0 : 1);
}

const id = await redis.rpop(PENDING);
if (typeof id !== "string") {
  console.log("no pending validations");
  process.exit(0);
}
await redis.lpush(PROCESSING, id);
const raw = await redis.get(taskKey(id));
const parsed = RealTaskSchema.safeParse(typeof raw === "string" ? JSON.parse(raw) : raw);
if (!parsed.success) {
  console.error("invalid task payload", id);
  process.exit(1);
}
const task = { ...parsed.data, status: "validating" };
await redis.set(taskKey(id), JSON.stringify(task));

const emit = async (gate, status, detail) => {
  await redis.rpush(
    eventsKey(id),
    JSON.stringify({ gate, status, detail, at: new Date().toISOString() }),
  );
  await redis.ltrim(eventsKey(id), -50, -1);
};

const result = await runGates(task, emit);
const status = result.failure === null ? "validated" : "rejected";
const next = RealTaskSchema.parse({
  ...task,
  status,
  license: result.license !== "unknown" ? result.license : task.license,
  validation: result.gates,
  ...(result.failure === null ? {} : { rejectionReason: result.failure }),
});
await redis.set(taskKey(id), JSON.stringify(next));
await redis.lrem(PROCESSING, 0, id);
await emit("complete", result.failure === null ? "pass" : "fail", result.failure ?? "validated");
console.log(JSON.stringify({ id, status, ...result }, null, 2));
