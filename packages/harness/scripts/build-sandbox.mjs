import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const proxyScript = resolve(packageRoot, "dist", "sandbox", "proxy-server.js");
const proxyPackage = resolve(packageRoot, "dist", "sandbox", "package.json");
const image = process.env.ORIVOXX_SANDBOX_IMAGE ?? "orivoxx/sandbox:1.0.0";

if (!existsSync(proxyScript) || !existsSync(proxyPackage)) {
  console.error(
    "The compiled model proxy is missing. Run `pnpm --filter @orivoxx/harness build` first.",
  );
  process.exit(1);
}

const child = spawn(
  "docker",
  [
    "build",
    "--pull",
    "-t",
    image,
    "-f",
    resolve(packageRoot, "docker", "sandbox.Dockerfile"),
    resolve(packageRoot, "docker"),
  ],
  { stdio: "inherit" },
);

child.once("error", (error) => {
  console.error(`docker build failed to start: ${error.message}`);
  process.exit(1);
});

child.once("close", (code) => {
  process.exit(code ?? 1);
});
