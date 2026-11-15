import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sandboxDist = resolve(packageRoot, "dist", "sandbox");

await mkdir(sandboxDist, { recursive: true });
await writeFile(
  resolve(sandboxDist, "package.json"),
  `${JSON.stringify({ type: "module" }, null, 2)}\n`,
  "utf8",
);
