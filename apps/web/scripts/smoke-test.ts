import { randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import OpenAI, { APIError } from "openai";

loadEnvConfig(process.cwd());

const DEFAULT_BASE_URL = "https://api.tokenfactory.nebius.com/v1/";
const DEFAULT_MODEL_ID = "nvidia/Nemotron-3.5-Super-VL";
const PROMPT =
  'Reply with valid JSON only, shape { "ok": true, "model": string }.';

async function main(): Promise<void> {
  const requestId = randomUUID();
  const apiKey = process.env.NEBIUS_API_KEY;
  const baseURL = process.env.NEBIUS_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const modelId = process.env.NEBIUS_MODEL_ID?.trim() || DEFAULT_MODEL_ID;

  if (!apiKey) {
    console.error("BLOCKED: NEBIUS_API_KEY is not configured");
    process.exitCode = 1;
    return;
  }

  const client = new OpenAI({
    apiKey,
    baseURL,
    timeout: 30_000,
    maxRetries: 0,
  });

  const startedAt = performance.now();

  try {
    const { data, response } = await client.chat.completions
      .create({
        model: modelId,
        messages: [{ role: "user", content: PROMPT }],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 200,
      })
      .withResponse();

    const latencyMs = Math.round(performance.now() - startedAt);
    const content = data.choices[0]?.message?.content;
    const contentText = typeof content === "string" ? content : "";

    let parsedContent: unknown = null;
    try {
      parsedContent = JSON.parse(contentText);
    } catch {
      parsedContent = null;
    }

    const parsesAsJson =
      parsedContent !== null &&
      typeof parsedContent === "object" &&
      !Array.isArray(parsedContent);
    const topLevelKeys =
      parsedContent !== null &&
      typeof parsedContent === "object" &&
      !Array.isArray(parsedContent)
        ? Object.keys(parsedContent)
        : [];

    console.log(`requestId: ${requestId}`);
    console.log(`modelId: ${data.model || modelId}`);
    console.log(`httpStatus: ${response.status}`);
    console.log(`latencyMs: ${latencyMs}`);
    console.log(`responseParsesAsJson: ${parsesAsJson}`);
    console.log(
      `assistantJsonTopLevelKeys: ${topLevelKeys.join(", ") || "(none)"}`,
    );
  } catch (error) {
    const status = error instanceof APIError ? (error.status ?? "unknown") : "unknown";
    const type = error instanceof APIError ? (error.type ?? "unknown") : error instanceof Error ? error.name : "unknown";
    const message = error instanceof Error ? error.message : "unknown error";

    console.error(
      `smoke test failed: requestId=${requestId} status=${status} type=${type} message=${message}`,
    );
    process.exitCode = 1;
  }
}

void main();
