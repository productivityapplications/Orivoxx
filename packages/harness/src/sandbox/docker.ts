import { execFile as execFileCallback, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  AgentCommandSchema,
  type AgentCommand,
  type AgentExecutor,
  type ExecutionRequest,
  type ExecutionResult,
} from "../contracts.js";
import { HarnessError } from "../errors.js";

const execFile = promisify(execFileCallback);

export const SANDBOX_IMAGE = "orivoxx/sandbox:1.0.0";
export const SANDBOX_NETWORK = "orivoxx-sandbox";
export const SANDBOX_EGRESS_NETWORK = "orivoxx-egress";
export const SANDBOX_USER = "10001:10001";
const SANDBOX_MAX_OUTPUT_BUFFER = 8 * 1024 * 1024;

export interface DockerExecutorOptions {
  image?: string;
  network?: "none" | "model-proxy";
  proxyBaseUrl?: string | null;
  proxyApiKey?: string | null;
  proxyScriptDir?: string;
  dockerBin?: string;
  memoryLimit?: string;
  pidsLimit?: number;
  cpus?: string;
  tmpfsSize?: string;
}

export interface DockerRunRequest {
  command: AgentCommand;
  workspace: string;
  timeoutMs: number;
  maxOutputBytes: number;
}

export interface DockerRunResult extends ExecutionResult {
  containerName: string;
}

/**
 * The platform's only permitted agent executor. `packages/harness` owns it and
 * nothing else in the workspace may spawn an agent process.
 */
export type SandboxRunner = AgentExecutor;

function safeDockerDetail(error: unknown): string {
  if (error !== null && typeof error === "object" && "code" in error) {
    return `exit code ${String((error as { code?: unknown }).code)}`;
  }

  return "docker command failed";
}

async function runDocker(
  dockerBin: string,
  args: readonly string[],
  timeout = 30_000,
): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFile(dockerBin, [...args], {
      timeout,
      maxBuffer: SANDBOX_MAX_OUTPUT_BUFFER,
    });

    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    throw new HarnessError(
      "sandbox_run_failed",
      "A Docker command failed.",
      safeDockerDetail(error),
    );
  }
}

export async function dockerAvailable(dockerBin = "docker"): Promise<boolean> {
  try {
    await execFile(dockerBin, ["info", "--format", "{{.ServerVersion}}"], {
      timeout: 10_000,
    });
    return true;
  } catch {
    return false;
  }
}

export async function ensureSandboxImage(
  image = SANDBOX_IMAGE,
  dockerBin = "docker",
): Promise<void> {
  try {
    await execFile(dockerBin, ["image", "inspect", "--format", "{{.Id}}", image], {
      timeout: 15_000,
    });
  } catch {
    throw new HarnessError(
      "sandbox_image_missing",
      `Sandbox image ${image} is not built. Run pnpm --filter @orivoxx/harness sandbox:build.`,
    );
  }
}

async function ensureNetwork(
  name: string,
  internal: boolean,
  dockerBin: string,
): Promise<void> {
  try {
    await execFile(dockerBin, ["network", "inspect", name], { timeout: 15_000 });
    return;
  } catch {
    // Create it below.
  }

  try {
    await execFile(
      dockerBin,
      ["network", "create", ...(internal ? ["--internal"] : []), name],
      { timeout: 15_000 },
    );
  } catch {
    // A concurrent run may have created it between inspect and create.
    await execFile(dockerBin, ["network", "inspect", name], { timeout: 15_000 });
  }
}

/**
 * The sandbox and proxy share one internal network. The proxy is the only
 * container attached to the egress network, so an agent can reach the model
 * only through the allowlisted proxy.
 */
export async function ensureSandboxNetworks(
  dockerBin = "docker",
): Promise<void> {
  await ensureNetwork(SANDBOX_NETWORK, true, dockerBin);
  await ensureNetwork(SANDBOX_EGRESS_NETWORK, false, dockerBin);
}

function proxyScriptDirectory(explicit?: string): string {
  return explicit ?? fileURLToPath(new URL("../../dist/sandbox", import.meta.url));
}

async function startProxy(
  containerName: string,
  image: string,
  options: DockerExecutorOptions,
  dockerBin: string,
  traceDirectory: string | null,
): Promise<void> {
  if (
    options.proxyBaseUrl === undefined ||
    options.proxyBaseUrl === null ||
    options.proxyBaseUrl.length === 0 ||
    options.proxyApiKey === undefined ||
    options.proxyApiKey === null ||
    options.proxyApiKey.length === 0
  ) {
    throw new HarnessError(
      "sandbox_proxy_misconfigured",
      "The model-proxy network requires a base URL and an API key.",
    );
  }

  const scriptDir = proxyScriptDirectory(options.proxyScriptDir);

  if (
    !existsSync(join(scriptDir, "proxy-server.js")) ||
    !existsSync(join(scriptDir, "package.json"))
  ) {
    throw new HarnessError(
      "sandbox_proxy_build_missing",
      "The compiled model proxy is missing. Run pnpm --filter @orivoxx/harness build.",
    );
  }

  await ensureSandboxNetworks(dockerBin);

  await runDocker(dockerBin, [
    "run",
    "-d",
    "--rm",
    "--name",
    containerName,
    "--network",
    SANDBOX_NETWORK,
    "--network-alias",
    "model-proxy",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=8m",
    "--user",
    SANDBOX_USER,
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--pids-limit",
    "64",
    "--memory",
    "256m",
    "--memory-swap",
    "256m",
    "-v",
    `${scriptDir}:/app:ro`,
    ...(traceDirectory === null
      ? []
      : ["-v", `${traceDirectory}:/trace:rw`, "-e", "MODEL_TRACE_FILE=/trace/proxy.jsonl"]),
    "-e",
    `MODEL_BASE_URL=${options.proxyBaseUrl}`,
    "-e",
    `MODEL_API_KEY=${options.proxyApiKey}`,
    "-e",
    "PROXY_PORT=8080",
    image,
    "node",
    "/app/proxy-server.js",
  ]);

  await runDocker(dockerBin, [
    "network",
    "connect",
    SANDBOX_EGRESS_NETWORK,
    containerName,
  ]);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await execFile(
        dockerBin,
        [
          "exec",
          containerName,
          "node",
          "-e",
          "fetch('http://127.0.0.1:8080/healthz').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))",
        ],
        { timeout: 5_000 },
      );
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw new HarnessError(
    "sandbox_run_failed",
    "The model proxy did not become ready.",
  );
}

async function removeContainer(
  containerName: string,
  dockerBin: string,
): Promise<void> {
  try {
    await execFile(dockerBin, ["rm", "-f", containerName], { timeout: 15_000 });
  } catch {
    // Already removed by --rm or by timeout cleanup.
  }
}

async function prepareWorkspace(workspace: string): Promise<void> {
  if (
    !isAbsolute(workspace) ||
    !basename(workspace).startsWith("orivoxx-run-")
  ) {
    throw new HarnessError(
      "invalid_workspace",
      "The Docker workspace must be an absolute harness run workspace.",
      workspace,
    );
  }

  try {
    await execFile("chown", ["-R", SANDBOX_USER, workspace], { timeout: 30_000 });
  } catch {
    await execFile("chmod", ["-R", "a+rwX", workspace], { timeout: 30_000 });
  }
}

function containerArgs(
  containerName: string,
  image: string,
  request: DockerRunRequest,
  options: DockerExecutorOptions,
  network: "none" | "model-proxy",
): string[] {
  return [
    "run",
    "--rm",
    "--name",
    containerName,
    "--network",
    network === "none" ? "none" : SANDBOX_NETWORK,
    "--read-only",
    "--tmpfs",
    `/tmp:rw,noexec,nosuid,size=${options.tmpfsSize ?? "32m"}`,
    "--user",
    SANDBOX_USER,
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--pids-limit",
    String(options.pidsLimit ?? 128),
    "--memory",
    options.memoryLimit ?? "512m",
    "--memory-swap",
    options.memoryLimit ?? "512m",
    "--cpus",
    options.cpus ?? "1",
    "--ulimit",
    "nofile=256:256",
    "--shm-size",
    "64m",
    "-v",
    `${request.workspace}:/workspace:rw`,
    "-w",
    "/workspace",
    "-e",
    "HOME=/tmp",
    "-e",
    "TMPDIR=/tmp",
    "-e",
    "NODE_ENV=production",
    ...Object.entries(request.command.env).flatMap(([key, value]) => [
      "-e",
      `${key}=${value}`,
    ]),
    image,
    request.command.file,
    ...request.command.args,
  ];
}

interface SpawnedRun {
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
}

async function spawnContainer(
  dockerBin: string,
  args: readonly string[],
  containerName: string,
  timeoutMs: number,
  maxOutputBytes: number,
): Promise<SpawnedRun> {
  const started = Date.now();
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let timedOut = false;

  const child = spawn(dockerBin, [...args], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk: Buffer) => {
    if (stdoutBytes >= maxOutputBytes) {
      return;
    }

    const remaining = maxOutputBytes - stdoutBytes;
    const slice = chunk.subarray(0, Math.min(remaining, chunk.byteLength));
    stdoutChunks.push(slice);
    stdoutBytes += slice.byteLength;
  });

  child.stderr.on("data", (chunk: Buffer) => {
    if (stderrBytes >= maxOutputBytes) {
      return;
    }

    const remaining = maxOutputBytes - stderrBytes;
    const slice = chunk.subarray(0, Math.min(remaining, chunk.byteLength));
    stderrChunks.push(slice);
    stderrBytes += slice.byteLength;
  });

  const exit = new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code));
  });
  let timer: NodeJS.Timeout | null = null;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });

  const outcome = await Promise.race([exit, timeout]);

  if (timer !== null) {
    clearTimeout(timer);
  }

  if (outcome === "timeout") {
    timedOut = true;
    await removeContainer(containerName, dockerBin);
    await exit;
  }

  return {
    exitCode: timedOut ? null : (outcome as number | null),
    timedOut,
    durationMs: Date.now() - started,
    stdout: Buffer.concat(stdoutChunks).toString("utf8"),
    stderr: Buffer.concat(stderrChunks).toString("utf8"),
  };
}

async function readProxyTrace(directory: string): Promise<unknown[]> {
  let raw: string;

  try {
    raw = await readFile(join(directory, "proxy.jsonl"), "utf8");
  } catch {
    return [];
  }

  const events: unknown[] = [];

  for (const line of raw.split("\n").slice(0, 500)) {
    if (line.trim().length === 0) {
      continue;
    }

    try {
      events.push(JSON.parse(line));
    } catch {
      // A malformed trace line is dropped; it never fails the run.
    }
  }

  return events;
}

export class DockerExecutor implements SandboxRunner {
  readonly id = "docker";
  readonly #options: DockerExecutorOptions;

  constructor(options: DockerExecutorOptions = {}) {
    this.#options = options;
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const parsed = AgentCommandSchema.safeParse(request.command);

    if (!parsed.success) {
      throw new HarnessError(
        "invalid_run_input",
        "The sandbox command failed validation.",
        parsed.error.issues.map((issue) => issue.message).join("; "),
      );
    }

    const command = parsed.data;
    const dockerBin = this.#options.dockerBin ?? "docker";
    const image = this.#options.image ?? SANDBOX_IMAGE;
    const network = this.#options.network ?? "none";

    await ensureSandboxImage(image, dockerBin);
    await prepareWorkspace(request.workspace);

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const containerName = `orivoxx-run-${runId}`;
    const proxyName = network === "model-proxy" ? `orivoxx-proxy-${runId}` : null;
    const traceDirectory =
      proxyName === null ? null : await mkdtemp(join(tmpdir(), "orivoxx-trace-"));

    if (traceDirectory !== null) {
      await chmod(traceDirectory, 0o777).catch(() => undefined);
    }

    if (proxyName !== null) {
      try {
        await startProxy(proxyName, image, this.#options, dockerBin, traceDirectory);
      } catch (error) {
        await removeContainer(proxyName, dockerBin);
        throw error;
      }
    }

    try {
      const result = await spawnContainer(
        dockerBin,
        containerArgs(
          containerName,
          image,
          { ...request, command },
          this.#options,
          network,
        ),
        containerName,
        request.timeoutMs,
        Math.min(request.maxOutputBytes, SANDBOX_MAX_OUTPUT_BUFFER),
      );

      const trace =
        traceDirectory === null ? undefined : await readProxyTrace(traceDirectory);

      return {
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        durationMs: result.durationMs,
        stdout: result.stdout,
        stderr: result.stderr,
        ...(trace === undefined ? {} : { trace }),
      };
    } finally {
      if (proxyName !== null) {
        await removeContainer(proxyName, dockerBin);
      }

      await removeContainer(containerName, dockerBin);

      if (traceDirectory !== null) {
        await rm(traceDirectory, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  }
}
