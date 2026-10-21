import "server-only";

import OpenAI from "openai";

import { getNebiusConfig } from "../env";

export type PingModelResult = {
  modelId: string;
  rawShape: {
    object: string | null;
    choiceCount: number;
    finishReason: string | null;
    messageKeys: string[];
    contentParsedAsJson: boolean;
    contentJsonKeys: string[];
  };
  latencyMs: number;
};

export async function pingModel(prompt: string): Promise<PingModelResult> {
  const { apiKey, baseUrl, modelId } = getNebiusConfig();
  const client = new OpenAI({
    apiKey,
    baseURL: baseUrl,
    timeout: 30_000,
    maxRetries: 0,
  });

  const startedAt = performance.now();
  const response = await client.chat.completions.create({
    model: modelId,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 200,
  });
  const latencyMs = Math.round(performance.now() - startedAt);

  const choice = response.choices[0];
  const message = choice?.message;
  const content = typeof message?.content === "string" ? message.content : "";

  let parsedContent: unknown = null;
  try {
    parsedContent = JSON.parse(content);
  } catch {
    parsedContent = null;
  }

  const contentParsedAsJson =
    parsedContent !== null &&
    typeof parsedContent === "object" &&
    !Array.isArray(parsedContent);
  const contentJsonKeys =
    parsedContent !== null &&
    typeof parsedContent === "object" &&
    !Array.isArray(parsedContent)
      ? Object.keys(parsedContent)
      : [];

  return {
    modelId: response.model || modelId,
    rawShape: {
      object: typeof response.object === "string" ? response.object : null,
      choiceCount: response.choices.length,
      finishReason: choice?.finish_reason ?? null,
      messageKeys: message ? Object.keys(message) : [],
      contentParsedAsJson,
      contentJsonKeys,
    },
    latencyMs,
  };
}
