import { createHash } from "node:crypto";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};

    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortValue(record[key]);
    }

    return sorted;
  }

  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function fingerprintRuleset(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}
