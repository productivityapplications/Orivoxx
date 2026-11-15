import { execFile as execFileCallback } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  evaluateRepository,
  getTask,
  getTaskFixtures,
} from "@orivoxx/benchmarks";

import { toNormalizedFiles } from "../capture.js";
import { SANDBOX_PROXY_KEY, type AgentAdapter, type AgentCommand } from "../contracts.js";
import { buildAdapterRunInput, runAdapter } from "../run.js";
import { createRunWorkspace, removeRunWorkspace, writeProjectFiles } from "../workspace.js";
import {
  dockerAvailable,
  DockerExecutor,
  ensureSandboxImage,
  ensureSandboxNetworks,
  SANDBOX_EGRESS_NETWORK,
  SANDBOX_IMAGE,
} from "./docker.js";

const execFile = promisify(execFileCallback);
const ENABLED = process.env.ORIVOXX_DOCKER_TESTS === "1";
const describeSandbox = ENABLED ? describe : describe.skip;
const DOCKER = "docker";

const PROVIDER_CONTAINER = "orivoxx-test-provider";
const PROVIDER_SOURCE = `
import http from "node:http";

const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end('{"ok":true}');
    return;
  }

  let body = "";
  request.on("data", (chunk) => { body += chunk; });
  request.on("end", () => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      ok: true,
      path: request.url,
      authorization: request.headers.authorization ?? null,
      receivedBytes: body.length,
    }));
  });
});

server.listen(9000, "0.0.0.0");
`;

const workspaces: string[] = [];

async function docker(args: readonly string[], timeout = 30_000): Promise<string> {
  const result = await execFile(DOCKER, [...args], {
    timeout,
    maxBuffer: 8 * 1024 * 1024,
  });

  return result.stdout;
}

async function dockerQuiet(args: readonly string[], timeout = 30_000): Promise<void> {
  try {
    await docker(args, timeout);
  } catch {
    // Best-effort cleanup.
  }
}

async function workspace(): Promise<string> {
  const directory = await createRunWorkspace();
  workspaces.push(directory);
  return directory;
}

async function writeScript(root: string, name: string, source: string): Promise<void> {
  await writeProjectFiles(root, [{ path: name, content: source }], { overwrite: true });
}

function existsOnHost(path: string): boolean {
  return existsSync(path);
}

async function containerNames(prefix: string): Promise<string[]> {
  const output = await docker([
    "ps",
    "-a",
    "--filter",
    `name=${prefix}`,
    "--format",
    "{{.Names}}",
  ]);

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function executor(
  options: ConstructorParameters<typeof DockerExecutor>[0] = {},
): DockerExecutor {
  return new DockerExecutor({ dockerBin: DOCKER, ...options });
}

function nodeCommand(args: readonly string[], env: AgentCommand["env"] = {}): AgentCommand {
  return { file: "node", args: [...args], env };
}

async function startProvider(): Promise<void> {
  await dockerQuiet(["rm", "-f", PROVIDER_CONTAINER]);
  await docker([
    "run",
    "-d",
    "--rm",
    "--name",
    PROVIDER_CONTAINER,
    "--network",
    SANDBOX_EGRESS_NETWORK,
    "--network-alias",
    "fake-provider",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=8m",
    "--user",
    "10001:10001",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--pids-limit",
    "32",
    "--memory",
    "128m",
    SANDBOX_IMAGE,
    "node",
    "--input-type=module",
    "-e",
    PROVIDER_SOURCE,
  ]);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await docker(
        [
          "exec",
          PROVIDER_CONTAINER,
          "node",
          "-e",
          "fetch('http://127.0.0.1:9000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))",
        ],
        5_000,
      );
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw new Error("The fake provider container did not become ready.");
}

beforeAll(async () => {
  if (!ENABLED) {
    return;
  }

  if (!(await dockerAvailable(DOCKER))) {
    throw new Error("ORIVOXX_DOCKER_TESTS=1 but the Docker daemon is not reachable.");
  }

  await ensureSandboxImage(SANDBOX_IMAGE, DOCKER);
  await ensureSandboxNetworks(DOCKER);
}, 120_000);

afterAll(async () => {
  await Promise.all(
    workspaces.splice(0).map((directory) =>
      removeRunWorkspace(directory).catch(() => undefined),
    ),
  );
  await dockerQuiet(["rm", "-f", PROVIDER_CONTAINER]);
});

describeSandbox("sandbox image", () => {
  it("exists with the expected hardened defaults", async () => {
    const image = await docker(["image", "inspect", "--format", "{{.Id}}", SANDBOX_IMAGE]);

    expect(image.trim()).toMatch(/^sha256:[a-f0-9]{64}$/);

    const user = await docker([
      "image",
      "inspect",
      "--format",
      "{{.Config.User}}",
      SANDBOX_IMAGE,
    ]);

    expect(user.trim()).toBe("10001:10001");
  });

  it("does not contain platform secrets or a docker socket", async () => {
    const listing = await docker([
      "run",
      "--rm",
      "--network",
      "none",
      "--read-only",
      "--user",
      "10001:10001",
      SANDBOX_IMAGE,
      "node",
      "-e",
      "console.log(JSON.stringify(Object.keys(process.env).sort()))",
    ]);

    const names = JSON.parse(listing.trim()) as string[];

    expect(names).not.toContain("OPENROUTER_API_KEY");
    expect(names).not.toContain("MODEL_API_KEY");
    expect(names).not.toContain("ELEVENLABS_API_KEY");
    expect(names).not.toContain("UPSTASH_REDIS_REST_TOKEN");

    const socket = await docker([
      "run",
      "--rm",
      "--network",
      "none",
      "--read-only",
      "--user",
      "10001:10001",
      SANDBOX_IMAGE,
      "node",
      "-e",
      "console.log(require('node:fs').existsSync('/var/run/docker.sock'))",
    ]);

    expect(socket.trim()).toBe("false");
  });
});

describeSandbox("sandbox end-to-end run", () => {
  it(
    "runs an agent, captures the workspace, and scores the produced repository",
    async () => {
      const task = getTask("taskboard");
      const fixtures = getTaskFixtures("taskboard");

      if (fixtures === undefined) {
        throw new Error("TaskBoard fixtures are missing.");
      }

      const agentSource = `
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = "/workspace";
const files = JSON.parse(await readFile(join(root, ".orivoxx-fixture.json"), "utf8"));

for (const file of files) {
  const target = join(root, file.path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, file.content, "utf8");
}

await rm(join(root, ".orivoxx-fixture.json"));
await rm(join(root, "agent.mjs"));
console.log("wrote " + files.length + " files");
`;

      const input = buildAdapterRunInput(task);
      const adapter: AgentAdapter = {
        id: "sandbox-test-agent",
        version: "1.0.0",
        label: "Sandbox test agent",
        kind: "harness",
        model: {
          provider: "openrouter",
          name: "openai/gpt-4o-mini",
          baseUrl: "https://openrouter.ai/api/v1",
        },
        plan() {
          return {
            kind: "process",
            command: nodeCommand(["/workspace/agent.mjs"], {
              MODEL_NAME: "openai/gpt-4o-mini",
            }),
          };
        },
      };

      const output = await runAdapter({
        adapter,
        input: {
          ...input,
          startingFiles: [
            ...input.startingFiles,
            { path: "agent.mjs", content: agentSource },
            {
              path: ".orivoxx-fixture.json",
              content: JSON.stringify(fixtures.compliant),
            },
          ],
        },
        workspace: await workspace(),
        executor: executor({ network: "none" }),
        capture: { maxFiles: 300, maxFileBytes: 307_200 },
      });

      expect(output.status).toBe("completed");
      expect(output.exitCode).toBe(0);
      expect(output.stdoutSummary).toContain(`wrote ${fixtures.compliant.length} files`);
      expect(output.files.map((file) => file.path)).toContain("src/lib/auth.ts");
      expect(output.files.map((file) => file.path)).not.toContain("agent.mjs");
      expect(output.files.map((file) => file.path)).not.toContain(".orivoxx-fixture.json");

      const evaluation = evaluateRepository({
        task,
        files: toNormalizedFiles(output.files),
        adapterVersion: "1.0.0",
        repositoryFingerprint: output.repositoryFingerprint,
      });

      expect(
        evaluation.outcomes.filter((outcome) => outcome.status !== "PASS"),
      ).toEqual([]);
      expect(evaluation.score.overall).toBeGreaterThan(95);
      expect(evaluation.score.capsApplied).toEqual([]);
      expect(evaluation.score.repositoryFingerprint).toBe(output.repositoryFingerprint);
    },
    180_000,
  );
});

describeSandbox("sandbox limits", () => {
  it(
    "kills a run that exceeds its time limit and removes the container",
    async () => {
      const root = await workspace();

      await writeScript(
        root,
        "hang.mjs",
        `
console.log("started");
setTimeout(() => {}, 120_000);
`,
      );

      const started = Date.now();
      const result = await executor().execute({
        command: nodeCommand(["/workspace/hang.mjs"]),
        workspace: root,
        timeoutMs: 2_000,
        maxOutputBytes: 65_536,
      });

      expect(result.timedOut).toBe(true);
      expect(result.exitCode).toBeNull();
      expect(Date.now() - started).toBeLessThan(30_000);
      expect(result.stdout).toContain("started");
      await expect(containerNames("orivoxx-run-")).resolves.toEqual([]);
    },
    90_000,
  );

  it(
    "bounds captured stdout so a noisy agent cannot exhaust memory",
    async () => {
      const root = await workspace();

      await writeScript(
        root,
        "noisy.mjs",
        `
const line = "x".repeat(1023);
for (let index = 0; index < 2048; index += 1) {
  process.stdout.write(line + "\\n");
}
`,
      );

      const result = await executor().execute({
        command: nodeCommand(["/workspace/noisy.mjs"]),
        workspace: root,
        timeoutMs: 30_000,
        maxOutputBytes: 4_096,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.length).toBeLessThanOrEqual(4_096);
    },
    90_000,
  );

  it(
    "enforces the PID quota inside the container",
    async () => {
      const root = await workspace();

      await writeScript(
        root,
        "fork.mjs",
        `
import { spawn } from "node:child_process";

let exhausted = 0;
const children = [];

for (let index = 0; index < 300; index += 1) {
  try {
    const child = spawn("/bin/sleep", ["3"], { stdio: "ignore" });
    child.on("error", (error) => {
      if (error.code === "EAGAIN") {
        exhausted += 1;
      }
    });
    children.push(child);
  } catch (error) {
    if (error.code === "EAGAIN") {
      exhausted += 1;
    }
  }
}

await new Promise((resolve) => setTimeout(resolve, 1500));
console.log(JSON.stringify({ exhausted, attempted: 300 }));
`,
      );

      const result = await executor({ memoryLimit: "1g", pidsLimit: 64 }).execute({
        command: nodeCommand(["/workspace/fork.mjs"]),
        workspace: root,
        timeoutMs: 30_000,
        maxOutputBytes: 65_536,
      });

      expect(result.exitCode).toBe(0);
      const report = JSON.parse(result.stdout.trim().split("\n").at(-1) ?? "{}") as {
        exhausted?: number;
      };

      expect(report.exhausted ?? 0).toBeGreaterThan(0);
    },
    120_000,
  );
});

describeSandbox("sandbox isolation", () => {
  it(
    "refuses filesystem writes outside the run workspace",
    async () => {
      const root = await workspace();

      await writeScript(
        root,
        "escape.mjs",
        `
import { writeFile } from "node:fs/promises";

const results = {};

async function attempt(name, run) {
  try {
    await run();
    results[name] = "written";
  } catch (error) {
    results[name] = error.code ?? String(error);
  }
}

await attempt("etcPasswd", () => writeFile("/etc/passwd", "root:x:0:0::/root:/bin/sh\\n"));
await attempt("rootFile", () => writeFile("/escape-root.txt", "escaped"));
await attempt("parentTraversal", () => writeFile("/workspace/../escape.txt", "escaped"));
await attempt("tmp", () => writeFile("/tmp/scoped.txt", "allowed"));

await writeFile("/workspace/escape-report.json", JSON.stringify(results, null, 2));
`,
      );

      const result = await executor().execute({
        command: nodeCommand(["/workspace/escape.mjs"]),
        workspace: root,
        timeoutMs: 30_000,
        maxOutputBytes: 65_536,
      });

      expect(result.exitCode).toBe(0);

      const report = JSON.parse(
        await readFile(join(root, "escape-report.json"), "utf8"),
      ) as Record<string, string>;

      for (const name of ["etcPasswd", "rootFile", "parentTraversal"]) {
        expect(["EROFS", "EACCES", "EPERM"], name).toContain(report[name]);
      }

      expect(report.tmp).toBe("written");
      expect(existsOnHost(join(dirname(root), "escape.txt"))).toBe(false);
      expect(existsOnHost("/escape-root.txt")).toBe(false);
    },
    90_000,
  );

  it(
    "keeps provider secrets and host paths out of the container",
    async () => {
      const root = await workspace();
      const hostSecrets = [
        process.env.OPENROUTER_API_KEY,
        process.env.MODEL_API_KEY,
        process.env.ELEVENLABS_API_KEY,
        process.env.UPSTASH_REDIS_REST_TOKEN,
      ].filter((value): value is string => value !== undefined && value.length >= 8);

      await writeScript(
        root,
        "env.mjs",
        `
import { writeFile } from "node:fs/promises";

await writeFile(
  "/workspace/env.json",
  JSON.stringify({ env: process.env, cwd: process.cwd(), uid: process.getuid() }, null, 2),
);
`,
      );

      const result = await executor().execute({
        command: nodeCommand(["/workspace/env.mjs"], {
          MODEL_PROXY_URL: "http://model-proxy:8080/v1",
          MODEL_NAME: "openai/gpt-4o-mini",
          OPENAI_API_KEY: SANDBOX_PROXY_KEY,
        }),
        workspace: root,
        timeoutMs: 30_000,
        maxOutputBytes: 65_536,
      });

      expect(result.exitCode).toBe(0);

      const dump = JSON.parse(await readFile(join(root, "env.json"), "utf8")) as {
        env: Record<string, string>;
        cwd: string;
        uid: number;
      };

      expect(dump.uid).toBe(10001);
      expect(dump.cwd).toBe("/workspace");
      expect(dump.env.OPENAI_API_KEY).toBe(SANDBOX_PROXY_KEY);
      expect(dump.env.HOME).toBe("/tmp");
      expect(dump.env.MODEL_API_KEY).toBeUndefined();
      expect(dump.env.OPENROUTER_API_KEY).toBeUndefined();
      expect(dump.env.MODEL_BASE_URL).toBeUndefined();

      const serialized = JSON.stringify(dump.env);

      for (const secret of hostSecrets) {
        expect(serialized).not.toContain(secret);
      }

      expect(serialized).not.toMatch(/sk-or-v1-[A-Za-z0-9]{16,}/);
    },
    90_000,
  );

  it(
    "allows model calls only through the allowlisted proxy",
    async () => {
      const root = await workspace();
      const providerKey = "test-provider-key-not-real";

      await startProvider();

      await writeScript(
        root,
        "network.mjs",
        `
import { writeFile } from "node:fs/promises";

const results = {};

results.health = await fetch("http://model-proxy:8080/healthz")
  .then((response) => response.status)
  .catch((error) => "error:" + (error.cause?.code ?? error.message));

results.proxied = await fetch("http://model-proxy:8080/v1/chat/completions", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: "Bearer ${SANDBOX_PROXY_KEY}",
  },
  body: JSON.stringify({ model: "openai/gpt-4o-mini", messages: [] }),
})
  .then((response) => response.json())
  .catch((error) => ({ error: String(error) }));

try {
  const response = await fetch("http://fake-provider:9000/", {
    signal: AbortSignal.timeout(3000),
  });
  results.directProvider = "reachable:" + response.status;
} catch (error) {
  results.directProvider = "blocked:" + (error.cause?.code ?? "error");
}

try {
  await fetch("http://1.1.1.1/", { signal: AbortSignal.timeout(3000) });
  results.rawInternet = "reachable";
} catch (error) {
  results.rawInternet = "blocked:" + (error.cause?.code ?? "error");
}

results.env = process.env;

await writeFile("/workspace/network.json", JSON.stringify(results, null, 2));
`,
      );

      const result = await executor({
        network: "model-proxy",
        proxyBaseUrl: `http://fake-provider:9000/api/v1`,
        proxyApiKey: providerKey,
      }).execute({
        command: nodeCommand(["/workspace/network.mjs"], {
          MODEL_PROXY_URL: "http://model-proxy:8080/v1",
          OPENAI_API_KEY: SANDBOX_PROXY_KEY,
        }),
        workspace: root,
        timeoutMs: 60_000,
        maxOutputBytes: 65_536,
      });

      expect(result.exitCode).toBe(0);

      const report = JSON.parse(await readFile(join(root, "network.json"), "utf8")) as {
        health: number | string;
        proxied: {
          ok?: boolean;
          path?: string;
          authorization?: string;
          receivedBytes?: number;
          error?: string;
        };
        directProvider: string;
        rawInternet: string;
        env: Record<string, string>;
      };

      expect(report.health).toBe(200);
      expect(report.proxied.ok).toBe(true);
      expect(report.proxied.path).toBe("/api/v1/chat/completions");
      expect(report.proxied.authorization).toBe(`Bearer ${providerKey}`);
      expect(report.proxied.receivedBytes).toBeGreaterThan(0);
      expect(report.directProvider).toMatch(/^blocked/);
      expect(report.rawInternet).toMatch(/^blocked/);
      expect(report.env.MODEL_API_KEY).toBeUndefined();
      expect(report.env.OPENAI_API_KEY).toBe(SANDBOX_PROXY_KEY);

      await expect(containerNames("orivoxx-proxy-")).resolves.toEqual([]);
    },
    120_000,
  );

  it(
    "requires a proxy base URL and key for the model-proxy network",
    async () => {
      const root = await workspace();

      await writeScript(root, "ok.mjs", "console.log('ok');");

      await expect(
        executor({ network: "model-proxy" }).execute({
          command: nodeCommand(["/workspace/ok.mjs"]),
          workspace: root,
          timeoutMs: 10_000,
          maxOutputBytes: 1024,
        }),
      ).rejects.toMatchObject({ code: "sandbox_proxy_misconfigured" });
    },
    60_000,
  );

  it(
    "refuses a workspace that is not a harness run directory",
    async () => {
      await expect(
        executor().execute({
          command: nodeCommand(["ok.mjs"]),
          workspace: "/tmp",
          timeoutMs: 1_000,
          maxOutputBytes: 1024,
        }),
      ).rejects.toMatchObject({ code: "invalid_workspace" });
    },
    30_000,
  );
});

describeSandbox("sandbox cleanup", () => {
  it("leaves no sandbox containers behind", async () => {
    await expect(containerNames("orivoxx-run-")).resolves.toEqual([]);
    await expect(containerNames("orivoxx-proxy-")).resolves.toEqual([]);
  });
});
