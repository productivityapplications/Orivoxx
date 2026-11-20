/**
 * Validation worker. Claims one pending community task and runs six gates in
 * the same Docker sandbox. Run locally (Docker required):
 *
 *   node --env-file=.env.local packages/harness/scripts/validate-task.mjs
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Redis } from "@upstash/redis";

import {
  cloneTaskRepository,
  cleanupClone,
  createRunWorkspace,
  DockerExecutor,
  parseTestCommand,
  removeRunWorkspace,
  writeProjectFiles,
} from "../dist/index.js";
import { RealTaskSchema, RealTaskValidationSchema } from "../../benchmarks/dist/index.js";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
const PENDING = "orivoxx:validations:pending";
const PROCESSING = "orivoxx:validations:processing";
const taskKey = (id) => `orivoxx:task:${id}`;
const eventsKey = (id) => `orivoxx:task:${id}:validation`;

async function event(id, gate, status, detail) {
  await redis.rpush(eventsKey(id), JSON.stringify({ gate, status, detail, at: new Date().toISOString() }));
  await redis.ltrim(eventsKey(id), -50, -1);
}

async function licenseOk(task, files) {
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
      if (typeof spdx === "string" && ["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "MPL-2.0"].includes(spdx)) return spdx;
      if (typeof spdx === "string") return spdx;
    }
  } catch {}
  const license = files.find((file) => /(^|\/)LICENSE$/i.test(file.path));
  if (!license) return "unknown";
  if (/MIT License|Permission is hereby granted, free of charge/i.test(license.content)) return "MIT";
  if (/Apache License/i.test(license.content)) return "Apache-2.0";
  if (/BSD 3-Clause/i.test(license.content)) return "BSD-3-Clause";
  return "unknown";
}

function dependenciesDeclared(files) {
  const pkg = files.find((file) => file.path === "package.json");
  if (!pkg) return false;
  try {
    const parsed = JSON.parse(pkg.content);
    return Object.keys(parsed.dependencies ?? {}).length > 0;
  } catch { return false; }
}

const id = await redis.rpop(PENDING);
if (typeof id !== "string") {
  console.log("no pending validations");
  process.exit(0);
}
await redis.lpush(PROCESSING, id);
const raw = await redis.get(taskKey(id));
const parsed = RealTaskSchema.safeParse(typeof raw === "string" ? JSON.parse(raw) : raw);
if (!parsed.success) { console.error("invalid task payload", id); process.exit(1); }
const task = { ...parsed.data, status: "validating" };
await redis.set(taskKey(id), JSON.stringify(task));

const gates = { cloned: false, installs: false, testFailsAtBase: false, deterministic: false, timeBounded: false, licenseOk: false, checkedAt: new Date().toISOString() };
let clone = null;
let failure = null;

try {
  await event(id, "cloned", "start", "fetching the repository at the base commit");
  clone = await cloneTaskRepository(task);
  gates.cloned = true;
  await event(id, "cloned", "pass", `${clone.files.length} text files`);

  const license = await licenseOk(task, clone.files);
  gates.licenseOk = license !== "unknown";
  await event(id, "license", gates.licenseOk ? "pass" : "fail", `license: ${license}`);

  gates.installs = !dependenciesDeclared(clone.files);
  await event(id, "installs", gates.installs ? "pass" : "fail", gates.installs ? "no external dependencies" : "dependencies require network; unsupported in this sandbox");

  const command = parseTestCommand(task.testCommand);
  const executor = new DockerExecutor({ network: "none" });
  const results = [];
  for (let run = 0; run < 3; run += 1) {
    const workspace = await createRunWorkspace();
    try {
      await writeProjectFiles(workspace, clone.files);
      const started = Date.now();
      const result = await executor.execute({ command, workspace, timeoutMs: 600_000, maxOutputBytes: 1_048_576 });
      results.push(result);
      await event(id, "test_fails_at_base", "start", `run ${run + 1}/3 exit=${result.exitCode} in ${Date.now() - started}ms`);
      if (result.timedOut || result.exitCode === 0) break;
    } finally {
      await removeRunWorkspace(workspace);
    }
  }
  gates.testFailsAtBase = results.length > 0 && results[0].timedOut === false && results[0].exitCode !== 0;
  gates.deterministic = results.length === 3 && results.every((result) => !result.timedOut && result.exitCode !== 0);
  gates.timeBounded = results.length > 0 && results.every((result) => result.durationMs < 600_000);
  await event(id, "test_fails_at_base", gates.testFailsAtBase ? "pass" : "fail", `base exit ${results[0]?.exitCode ?? "timeout"}`);
  await event(id, "deterministic", gates.deterministic ? "pass" : "fail", `${results.length} failing runs`);
  await event(id, "time_bounded", gates.timeBounded ? "pass" : "fail", `${results.map((r) => r.durationMs).join(", ")}ms`);

  if (!gates.installs) failure = "dependencies_not_supported";
  else if (!gates.licenseOk) failure = "license_not_permissive";
  else if (!gates.testFailsAtBase) failure = "test_does_not_fail_at_base";
  else if (!gates.deterministic) failure = "test_not_deterministic";
  else if (!gates.timeBounded) failure = "test_exceeds_time_budget";
} catch (error) {
  failure = error instanceof Error ? error.message.slice(0, 200) : "validation_error";
  await event(id, "error", "fail", failure);
} finally {
  if (clone) await cleanupClone(clone.directory);
}

const validation = RealTaskValidationSchema.parse(gates);
const status = failure === null ? "validated" : "rejected";
const next = RealTaskSchema.parse({
  ...task,
  status,
  license: gates.licenseOk ? (await licenseOk(task, clone?.files ?? [])) : task.license,
  validation,
  ...(failure === null ? {} : { rejectionReason: failure }),
});
await redis.set(taskKey(id), JSON.stringify(next));
await redis.lrem(PROCESSING, 0, id);
await event(id, "complete", failure === null ? "pass" : "fail", failure ?? "validated");
console.log(JSON.stringify({ id, status, validation, failure }, null, 2));
