import "server-only";

import { z } from "zod";

/** Featured provider. Any OpenAI-compatible endpoint works through the env. */
export const DEFAULT_MODEL_PROVIDER = "openrouter";
export const DEFAULT_MODEL_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_MODEL_NAME = "openai/gpt-4o-mini";
export const DEFAULT_FALLBACK_MODEL_NAME = "deepseek/deepseek-chat-v3-0324";
export const DEFAULT_DEMO_SECOND_MODEL = "deepseek/deepseek-chat-v3-0324";
export const DEFAULT_DATA_DIR = ".data/results";

/** Demoted legacy provider. Optional, not featured, never required. */
export const DEFAULT_NEBIUS_BASE_URL = "https://api.tokenfactory.nebius.com/v1/";
export const DEFAULT_NEBIUS_MODEL_ID = "nvidia/Nemotron-3.5-Super-VL";

const emptyToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim().length === 0 ? undefined : value;

const serverEnvSchema = z.object({
  MODEL_PROVIDER: z.preprocess(
    emptyToUndefined,
    z.string().min(1).max(64).default(DEFAULT_MODEL_PROVIDER),
  ),
  MODEL_BASE_URL: z.preprocess(
    emptyToUndefined,
    z.url().max(2048).default(DEFAULT_MODEL_BASE_URL),
  ),
  MODEL_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  OPENROUTER_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  MODEL_NAME: z.preprocess(
    emptyToUndefined,
    z.string().min(1).max(200).default(DEFAULT_MODEL_NAME),
  ),
  FALLBACK_MODEL_NAME: z.preprocess(
    emptyToUndefined,
    z.string().min(1).max(200).default(DEFAULT_FALLBACK_MODEL_NAME),
  ),
  DEMO_SECOND_MODEL: z.preprocess(
    emptyToUndefined,
    z.string().min(1).max(200).default(DEFAULT_DEMO_SECOND_MODEL),
  ),
  UPSTASH_REDIS_REST_URL: z.preprocess(emptyToUndefined, z.url().max(2048).optional()),
  UPSTASH_REDIS_REST_TOKEN: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  ORIVOXX_DATA_DIR: z.preprocess(
    emptyToUndefined,
    z.string().min(1).max(1024).default(DEFAULT_DATA_DIR),
  ),
  NEBIUS_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  NEBIUS_BASE_URL: z.preprocess(
    emptyToUndefined,
    z.url().default(DEFAULT_NEBIUS_BASE_URL),
  ),
  NEBIUS_MODEL_ID: z.preprocess(
    emptyToUndefined,
    z.string().min(1).default(DEFAULT_NEBIUS_MODEL_ID),
  ),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export type ModelConfig = {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  fallbackModel: string;
  demoSecondModel: string;
};

export type NebiusConfig = {
  apiKey: string;
  baseUrl: string;
  modelId: string;
};

export function getServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse({
    MODEL_PROVIDER: process.env.MODEL_PROVIDER,
    MODEL_BASE_URL: process.env.MODEL_BASE_URL,
    MODEL_API_KEY: process.env.MODEL_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    MODEL_NAME: process.env.MODEL_NAME,
    FALLBACK_MODEL_NAME: process.env.FALLBACK_MODEL_NAME,
    DEMO_SECOND_MODEL: process.env.DEMO_SECOND_MODEL,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    ORIVOXX_DATA_DIR: process.env.ORIVOXX_DATA_DIR,
    NEBIUS_API_KEY: process.env.NEBIUS_API_KEY,
    NEBIUS_BASE_URL: process.env.NEBIUS_BASE_URL,
    NEBIUS_MODEL_ID: process.env.NEBIUS_MODEL_ID,
  });

  if (!parsed.success) {
    throw new Error("Invalid server environment configuration");
  }

  return parsed.data;
}

/** `MODEL_API_KEY` wins; `OPENROUTER_API_KEY` is the documented alias. */
export function resolveModelApiKey(env: ServerEnv): string | undefined {
  return env.MODEL_API_KEY ?? env.OPENROUTER_API_KEY;
}

export function isModelConfigured(): boolean {
  return resolveModelApiKey(getServerEnv()) !== undefined;
}

export function getModelConfig(): ModelConfig {
  const env = getServerEnv();
  const apiKey = resolveModelApiKey(env);

  if (apiKey === undefined) {
    throw new Error("MODEL_API_KEY or OPENROUTER_API_KEY is not configured");
  }

  return {
    provider: env.MODEL_PROVIDER,
    baseUrl: env.MODEL_BASE_URL,
    apiKey,
    model: env.MODEL_NAME,
    fallbackModel: env.FALLBACK_MODEL_NAME,
    demoSecondModel: env.DEMO_SECOND_MODEL,
  };
}

export function getNebiusConfig(): NebiusConfig {
  const env = getServerEnv();

  if (!env.NEBIUS_API_KEY) {
    throw new Error("NEBIUS_API_KEY is not configured");
  }

  return {
    apiKey: env.NEBIUS_API_KEY,
    baseUrl: env.NEBIUS_BASE_URL,
    modelId: env.NEBIUS_MODEL_ID,
  };
}

/**
 * Operator kill switch for all mutating run/task submission. It is checked
 * before rate limiting or any model work, so a budget incident can be stopped
 * without a deploy.
 */
export function runsDisabled(): boolean {
  return process.env.ORIVOXX_RUNS_DISABLED === "1";
}
