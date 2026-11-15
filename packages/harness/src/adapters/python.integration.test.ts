import { execFile as execFileCallback, spawnSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execFile = promisify(execFileCallback);
const SCRIPT = fileURLToPath(new URL("../../agents/python_openrouter.py", import.meta.url));
const HAS_PYTHON = spawnSync("python3", ["--version"]).status === 0;
const describePython = HAS_PYTHON ? describe : describe.skip;

const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup().catch(() => undefined)));
});

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (address === null || typeof address === "string") {
        reject(new Error("failed to bind the stub provider"));
        return;
      }

      resolve(address.port);
    });
  });
}

async function stubProvider(
  handler: (body: { messages?: { content?: string }[] }) => {
    status: number;
    content?: string;
  },
): Promise<string> {
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        messages?: { content?: string }[];
      };
      const reply = handler(body);

      if (reply.status !== 200) {
        response.writeHead(reply.status, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: { message: "provider detail should not leak" } }));
        return;
      }

      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          choices: [{ message: { role: "assistant", content: reply.content ?? "" } }],
        }),
      );
    });
  });
  const port = await listen(server);

  cleanups.push(
    () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  );

  return `http://127.0.0.1:${port}/v1`;
}

async function workspace(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "orivoxx-python-agent-"));
  cleanups.push(() => rm(directory, { recursive: true, force: true }));

  await writeFile(
    join(directory, "PROJECT_SPEC.md"),
    "# Project\n\nCreate `src/app/api/tasks/route.ts`.\n",
    "utf8",
  );
  await writeFile(join(directory, "package.json"), '{"name":"fixture"}\n', "utf8");

  return directory;
}

function run(directory: string, proxyUrl: string) {
  return execFile("python3", [SCRIPT], {
    cwd: directory,
    timeout: 60_000,
    env: {
      PATH: process.env.PATH ?? "/usr/bin:/bin",
      ORIVOXX_WORKSPACE: directory,
      MODEL_PROXY_URL: proxyUrl,
      MODEL_NAME: "openai/gpt-4o-mini",
      MAX_STEPS: "4",
      TASK_ID: "taskboard",
      PYTHONUNBUFFERED: "1",
    },
  });
}

describePython("python-openrouter agent loop", () => {
  it("plans, filters unsafe paths, and writes validated files", async () => {
    const directory = await workspace();
    const proxyUrl = await stubProvider((body) => {
      const prompt = body.messages?.at(-1)?.content ?? "";

      if (prompt.includes("Plan the files")) {
        return {
          status: 200,
          content: JSON.stringify({
            files: [
              "src/app/api/tasks/route.ts",
              "../escape.ts",
              ".env",
              "node_modules/pkg/index.js",
              "src/lib/auth.ts",
            ],
          }),
        };
      }

      return { status: 200, content: "export const ok = true;\n" };
    });

    const { stdout } = await run(directory, proxyUrl);

    expect(stdout).toContain("plan: 2 files");
    expect(stdout).toContain("wrote src/app/api/tasks/route.ts");
    expect(stdout).toContain("wrote src/lib/auth.ts");
    expect(await readFile(join(directory, "src/app/api/tasks/route.ts"), "utf8")).toBe(
      "export const ok = true;\n",
    );

    await expect(readFile(join(directory, "..", "escape.ts"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(readFile(join(directory, ".env"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("strips a markdown fence from the model output", async () => {
    const directory = await workspace();
    const proxyUrl = await stubProvider((body) => {
      const prompt = body.messages?.at(-1)?.content ?? "";

      if (prompt.includes("Plan the files")) {
        return { status: 200, content: '```json\n{"files":["src/lib/auth.ts"]}\n```' };
      }

      return { status: 200, content: "```ts\nexport const fenced = true;\n```" };
    });

    await run(directory, proxyUrl);

    expect(await readFile(join(directory, "src/lib/auth.ts"), "utf8")).toBe(
      "export const fenced = true;\n",
    );
  });

  it("fails safely on a provider error without leaking the body", async () => {
    const directory = await workspace();
    const proxyUrl = await stubProvider(() => ({ status: 500 }));

    const failure = await run(directory, proxyUrl).catch((error: unknown) => error);

    expect(failure).toMatchObject({ code: 1 });
    expect(String((failure as { stderr?: string }).stderr)).toContain(
      "model provider returned HTTP 500",
    );
    expect(String((failure as { stderr?: string }).stderr)).not.toContain(
      "provider detail should not leak",
    );
    await expect(readFile(join(directory, "src/lib/auth.ts"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("refuses a workspace without the project spec", async () => {
    const directory = await mkdtemp(join(tmpdir(), "orivoxx-python-agent-"));
    cleanups.push(() => rm(directory, { recursive: true, force: true }));
    await mkdir(join(directory, "src"), { recursive: true });

    const failure = await run(directory, "http://127.0.0.1:9/v1").catch(
      (error: unknown) => error,
    );

    expect(String((failure as { stderr?: string }).stderr)).toContain(
      "PROJECT_SPEC.md is missing",
    );
  });
});
