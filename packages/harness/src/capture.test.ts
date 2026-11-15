import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { captureWorkspace, toNormalizedFiles } from "./capture.js";
import { HarnessError } from "./errors.js";
import { createRunWorkspace, removeRunWorkspace } from "./workspace.js";

const workspaces: string[] = [];

async function workspace(): Promise<string> {
  const dir = await createRunWorkspace();
  workspaces.push(dir);
  return dir;
}

async function write(root: string, path: string, content: string): Promise<void> {
  const target = join(root, path);
  await mkdir(join(target, ".."), { recursive: true });
  await writeFile(target, content, "utf8");
}

afterEach(async () => {
  await Promise.all(
    workspaces.splice(0).map((dir) => removeRunWorkspace(dir).catch(() => undefined)),
  );
});

describe("bounded artifact capture", () => {
  it("captures sorted, normalized text files and excludes unsafe paths", async () => {
    const root = await workspace();

    await write(root, "src/b.ts", "export const b = 2;\r\n");
    await write(root, "src/a.ts", "export const a = 1;\n");
    await write(root, ".env", "SECRET=1\n");
    await write(root, "node_modules/pkg/index.js", "module.exports = {};\n");
    await write(root, "package.json", "{}\n");

    const result = await captureWorkspace(root, { maxFileBytes: 4096 });

    expect(result.files.map((file) => file.path)).toEqual([
      "package.json",
      "src/a.ts",
      "src/b.ts",
    ]);
    expect(result.files[1]?.content).toBe("export const a = 1;\n");
    expect(result.files[1]?.language).toBe("typescript");
    expect(result.stats.excludedFiles).toBeGreaterThanOrEqual(2);
    expect(result.repositoryFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("redacts secret values and flags the file", async () => {
    const root = await workspace();

    await write(
      root,
      "src/config.ts",
      'export const key = "sk-or-v1-abcdefghijklmnopqrstuvwxyz012345";\n',
    );

    const result = await captureWorkspace(root);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.redacted).toBe(true);
    expect(result.files[0]?.content).not.toContain("sk-or-v1-abcdefghijklmnopqrstuvwxyz012345");
    expect(result.stats.redactedFiles).toBe(1);
  });

  it("rejects a symbolic link in the produced workspace", async () => {
    const root = await workspace();

    await write(root, "src/real.ts", "export const real = 1;\n");
    await symlink(join(root, "src/real.ts"), join(root, "src/link.ts"));

    await expect(captureWorkspace(root)).rejects.toMatchObject({
      code: "symlink_entry",
    });
  });

  it("excludes an oversized file with a warning instead of truncating it", async () => {
    const root = await workspace();

    await write(root, "src/small.ts", "export const small = 1;\n");
    await write(root, "src/large.ts", "a".repeat(2048));

    const result = await captureWorkspace(root, { maxFileBytes: 1024 });

    expect(result.files.map((file) => file.path)).toEqual(["src/small.ts"]);
    expect(result.warnings).toContainEqual(
      "excluded: src/large.ts (reason: oversized_eligible_file)",
    );
  });

  it("rejects an aggregate that exceeds the text budget", async () => {
    const root = await workspace();

    await write(root, "a.ts", "a".repeat(64));
    await write(root, "b.ts", "b".repeat(64));

    await expect(
      captureWorkspace(root, { maxAggregateBytes: 100 }),
    ).rejects.toMatchObject({ code: "artifact_aggregate_exceeded" });
  });

  it("rejects a repository with no eligible files", async () => {
    const root = await workspace();

    await write(root, "logo.png", "\0binary");

    await expect(captureWorkspace(root)).rejects.toMatchObject({
      code: "no_eligible_files",
    });
  });

  it("produces a stable repository fingerprint", async () => {
    const first = await workspace();
    const second = await workspace();

    for (const root of [first, second]) {
      await write(root, "src/a.ts", "export const a = 1;\n");
      await write(root, "src/b.ts", "export const b = 2;\n");
    }

    const left = await captureWorkspace(first);
    const right = await captureWorkspace(second);

    expect(left.repositoryFingerprint).toBe(right.repositoryFingerprint);

    await write(second, "src/a.ts", "export const a = 3;\n");

    const changed = await captureWorkspace(second);

    expect(changed.repositoryFingerprint).not.toBe(left.repositoryFingerprint);
  });

  it("converts captured files back into normalized scoring input", async () => {
    const root = await workspace();

    await write(root, "src/a.ts", "export const a = 1;\n");

    const captured = await captureWorkspace(root);
    const normalized = toNormalizedFiles(captured.files);

    expect(normalized[0]?.path).toBe("src/a.ts");
    expect(normalized[0]?.content).toBe("export const a = 1;\n");
    expect(normalized[0]?.fingerprint).toBe(captured.files[0]?.fingerprint);
  });
});

describe("harness error codes", () => {
  it("uses a typed error for a missing capture root", async () => {
    const root = await workspace();

    await expect(
      captureWorkspace(join(root, "missing")),
    ).rejects.toBeInstanceOf(HarnessError);
  });
});
