import { startModelProxy } from "./proxy.js";

const baseUrl = process.env.MODEL_BASE_URL;
const apiKey = process.env.MODEL_API_KEY ?? process.env.OPENROUTER_API_KEY;
const port = Number(process.env.PROXY_PORT ?? "8080");

if (baseUrl === undefined || apiKey === undefined || apiKey.length === 0) {
  console.error("model-proxy: MODEL_BASE_URL and MODEL_API_KEY are required");
  process.exit(2);
}

const proxy = await startModelProxy({
  baseUrl,
  apiKey,
  port: Number.isFinite(port) ? port : 8080,
});

console.log(`model-proxy: listening on ${proxy.url}`);

function shutdown(): void {
  void proxy.close().then(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
