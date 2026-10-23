import type { Check, Evidence } from "../contracts/index.js";

export type EvidenceDraftCheckType = Check["type"];

export interface EvidenceDraft {
  type: Evidence["type"];
  origin: "deterministic";
  path?: string;
  startLine?: number;
  endLine?: number;
  summary: string;
  requirementIdHint?: string;
  checkType?: EvidenceDraftCheckType;
}

export interface EvidenceRegistry {
  records: Evidence[];
  byId: Map<string, Evidence>;
  byRequirement: Map<string, string[]>;
  notes: string[];
}

export class EvidenceValidationError extends Error {
  readonly code = "invalid_evidence_record";
  readonly fieldPath: string;

  constructor(fieldPath: string, detail: string) {
    super(`Evidence record validation failed at "${fieldPath}": ${detail}`);
    this.name = "EvidenceValidationError";
    this.fieldPath = fieldPath;
  }
}
