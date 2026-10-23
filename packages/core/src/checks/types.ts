import type { NormalizedFile } from "../archive/types.js";
import type { EvidenceDraft } from "../evidence/types.js";

export interface CheckContext {
  files: NormalizedFile[];
  dependencies: string[];
}

export type CheckOutcome =
  | { status: "PASS"; evidence: EvidenceDraft[] }
  | { status: "FAIL"; evidence: EvidenceDraft[] };
