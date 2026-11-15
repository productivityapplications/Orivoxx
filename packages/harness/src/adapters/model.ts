import { AdapterModelSchema, type AdapterModel } from "../contracts.js";

export const DEFAULT_MODEL_PROVIDER = "openrouter";
export const DEFAULT_MODEL_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_MODEL_NAME = "openai/gpt-4o-mini";

export interface OpenRouterModelOptions {
  modelName?: string;
  modelProvider?: string;
  modelBaseUrl?: string;
}

/** Resolves the model identity recorded on a run. Model is configuration, never a constant. */
export function resolveOpenRouterModel(options: OpenRouterModelOptions = {}): AdapterModel {
  return AdapterModelSchema.parse({
    provider: options.modelProvider ?? process.env.MODEL_PROVIDER ?? DEFAULT_MODEL_PROVIDER,
    name: options.modelName ?? process.env.MODEL_NAME ?? DEFAULT_MODEL_NAME,
    baseUrl: options.modelBaseUrl ?? process.env.MODEL_BASE_URL ?? DEFAULT_MODEL_BASE_URL,
  });
}
