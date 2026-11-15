import { execFile as execFileCallback, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execFile = promisify(execFileCallback);
const RUNNER = fileURLToPath(new URL("../../agents/aider_runner.py", import.meta.url));
const HAS_PYTHON = spawnSync("python3", ["--version"]).status === 0;
const describeAider = HAS_PYTHON ? describe : describe.skip;
const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup().catch(() => undefined)));
});

async function workspace(spec: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "orivoxx-aider-runner-"));
  cleanups.push(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, "PROJECT_SPEC.md"), spec, "utf8");
  return directory;
}

const INSPECT = `
import importlib.util, json, sys

spec = importlib.util.spec_from_file_location("aider_runner", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

print(json.dumps({
  "files": module.spec_files(),
  "command": module.build_command(module.spec_files()),
}))
`;

describeAider("aider runner", () => {
  it("extracts the longest extension and keeps spec order", async () => {
    const directory = await workspace(
      [
        "# Spec",
        "",
        "Create `src/components/TaskList.tsx` and src/app/api/tasks/route.ts.",
        "Also see `src/lib/session.ts`.",
        "Do not edit node_modules or .env.",
      ].join("\n"),
    );

    const { stdout } = await execFile("python3", ["-c", INSPECT, RUNNER], {
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        ORIVOXX_WORKSPACE: directory,
        MODEL_PROXY_URL: "http://model-proxy:8080/v1",
        MODEL_NAME: "openai/gpt-4o-mini",
        AIDER_OPENAI_API_KEY: "orivoxx-sandbox-proxy",
      },
    });
    const report = JSON.parse(stdout) as { files: string[]; command: string[] };

    expect(report.files).toContain("src/components/TaskList.tsx");
    expect(report.files).not.toContain("src/components/TaskList.ts");
    expect(report.files).toContain("src/app/api/tasks/route.ts");
    expect(report.files).toContain("src/lib/session.ts");
  });

  it("pins the model, the proxy, and the non-interactive flags", async () => {
    const directory = await workspace("Create `src/lib/auth.ts`.");
    const { stdout } = await execFile("python3", ["-c", INSPECT, RUNNER], {
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        ORIVOXX_WORKSPACE: directory,
        MODEL_PROXY_URL: "http://model-proxy:8080/v1",
        MODEL_NAME: "openai/gpt-4o-mini",
        AIDER_OPENAI_API_KEY: "orivoxx-sandbox-proxy",
      },
    });
    const command = (JSON.parse(stdout) as { command: string[] }).command;
    const valueOf = (flag: string) => command[command.indexOf(flag) + 1];

    expect(command[0]).toBe("aider");
    expect(valueOf("--model")).toBe("openai/openai/gpt-4o-mini");
    expect(valueOf("--openai-api-base")).toBe("http://model-proxy:8080/v1");
    expect(valueOf("--openai-api-key")).toBe("orivoxx-sandbox-proxy");
    expect(valueOf("--edit-format")).toBe("whole");
    expect(command).toContain("--yes-always");
    expect(command).toContain("--no-git");
    expect(command).not.toContain("--max-chat-tokens");
    expect(valueOf("--chat-history-file")).toBe("/tmp/aider-chat.md");
  });
});
