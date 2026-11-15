import { AdapterKindSchema, AdapterModelSchema, type AgentAdapter } from "../contracts.js";
import { HarnessError } from "../errors.js";
import { createAiderOpenRouterAdapter } from "./aider.js";
import { createFakeAdapter, FAKE_ADAPTER_ID } from "./fake.js";
import { createPythonOpenRouterAdapter } from "./python.js";

export interface AdapterSummary {
  id: string;
  version: string;
  label: string;
  kind: "baseline" | "harness";
  model: { provider: string; name: string; baseUrl: string | null } | null;
}

const ADAPTERS: readonly AgentAdapter[] = [
  createFakeAdapter(),
  createPythonOpenRouterAdapter(),
  createAiderOpenRouterAdapter(),
];

export function listAdapters(): readonly AgentAdapter[] {
  return ADAPTERS;
}

export function adapterSummaries(): AdapterSummary[] {
  return ADAPTERS.map((adapter) => ({
    id: adapter.id,
    version: adapter.version,
    label: adapter.label,
    kind: AdapterKindSchema.parse(adapter.kind),
    model:
      adapter.model === null ? null : AdapterModelSchema.parse(adapter.model),
  }));
}

export function getAdapter(adapterId: string): AgentAdapter {
  const adapter = ADAPTERS.find((candidate) => candidate.id === adapterId);

  if (adapter === undefined) {
    throw new HarnessError("invalid_run_input", `Unknown adapter "${adapterId}".`);
  }

  return adapter;
}

export { FAKE_ADAPTER_ID };
