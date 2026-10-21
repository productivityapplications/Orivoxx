import "server-only";

import { z } from "zod";

export const DEFAULT_NEBIUS_BASE_URL = "https://api.tokenfactory.nebius.com/v1/";
export const DEFAULT_NEBIUS_MODEL_ID = "nvidia/Nemotron-3.5-Super-VL";

const emptyToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim().length === 0 ? undefined : value;

const serverEnvSchema = z.object({
  NEBIUS_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  NEBIUS_BASE_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().default(DEFAULT_NEBIUS_BASE_URL),
  ),
  NEBIUS_MODEL_ID: z.preprocess(
    emptyToUndefined,
    z.string().min(1).default(DEFAULT_NEBIUS_MODEL_ID),
  ),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export type NebiusConfig = {
  apiKey: string;
  baseUrl: string;
  modelId: string;
};

export function getServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse({
    NEBIUS_API_KEY: process.env.NEBIUS_API_KEY,
    NEBIUS_BASE_URL: process.env.NEBIUS_BASE_URL,
    NEBIUS_MODEL_ID: process.env.NEBIUS_MODEL_ID,
  });

  if (!parsed.success) {
    throw new Error("Invalid server environment configuration");
  }

  return parsed.data;
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
