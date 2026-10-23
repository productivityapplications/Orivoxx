import { createHash } from "node:crypto";

import type { NormalizedFile } from "../archive/types.js";
import type { VerificationReport } from "../contracts/index.js";
import { buildCheckContext, runChecks } from "../checks/index.js";
import { buildEvidenceRegistry, type EvidenceDraft } from "../evidence/index.js";
import { parseSpec, type SpecParseErrorCode } from "../spec-parser/index.js";
import { aggregate } from "../verdict/index.js";
import { buildReport } from "./report.js";

export const DEFAULT_MODEL_ID = "nvidia/Nemotron-3.5-Super-VL";

export class DeterministicVerificationError extends Error {
  readonly code = "invalid_spec";
  readonly specCode: SpecParseErrorCode;
  readonly line: number;

  constructor(specCode: SpecParseErrorCode, message: string, line: number) {
    super(message);
    this.name = "DeterministicVerificationError";
    this.specCode = specCode;
    this.line = line;
  }
}

function comparePaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function computeSnapshotFingerprint(
  specText: string,
  files: NormalizedFile[],
): string {
  const hash = createHash("sha256");
  const sortedFiles = [...files].sort((left, right) =>
    comparePaths(left.path, right.path),
  );

  hash.update("orivoxx-snapshot-v1\n", "utf8");

  for (const file of sortedFiles) {
    hash.update(`${file.path}\n${file.fingerprint}\n`, "utf8");
  }

  const specFingerprint = createHash("sha256").update(specText, "utf8").digest("hex");
  hash.update(`spec\n${specFingerprint}\n`, "utf8");

  return hash.digest("hex");
}

export interface VerifyDeterministicInput {
  projectName: string;
  specText: string;
  files: NormalizedFile[];
  warnings?: string[];
  modelId?: string;
  now?: Date;
}

export function verifyDeterministic(
  input: VerifyDeterministicInput,
): VerificationReport {
  const parsedSpec = parseSpec(input.specText);

  if (!parsedSpec.ok) {
    throw new DeterministicVerificationError(
      parsedSpec.error.code,
      parsedSpec.error.message,
      parsedSpec.error.line,
    );
  }

  const snapshotFingerprint = computeSnapshotFingerprint(
    input.specText,
    input.files,
  );
  const context = buildCheckContext(input.files);
  const checkResults = runChecks(parsedSpec.requirements, context);
  const drafts: EvidenceDraft[] = [];

  for (const requirement of parsedSpec.requirements) {
    const outcome = checkResults.get(requirement.id);

    if (outcome === undefined) {
      continue;
    }

    for (const draft of outcome.evidence) {
      drafts.push({ ...draft, requirementIdHint: requirement.id });
    }
  }

  const registry = buildEvidenceRegistry(drafts, snapshotFingerprint);
  const verdict = aggregate({
    requirements: parsedSpec.requirements,
    checkResults,
    assessments: [],
    requirementToEvidenceIds: registry.byRequirement,
    evidence: registry.records,
  });
  const warnings = [
    ...(input.warnings ?? []),
    ...parsedSpec.warnings.map(
      (warning) => `Spec warning (line ${warning.line}): ${warning.message}`,
    ),
  ];

  return buildReport({
    projectName: input.projectName,
    snapshotFingerprint,
    requirements: parsedSpec.requirements,
    requirementResults: verdict.requirementResults,
    findings: verdict.findings,
    evidence: registry.records,
    warnings,
    gate: verdict.gate,
    runState: verdict.runState,
    summary: verdict.summary,
    model: {
      provider: "nebius-token-factory",
      modelId: input.modelId ?? DEFAULT_MODEL_ID,
      called: false,
    },
    ...(input.now === undefined ? {} : { now: input.now }),
  });
}
